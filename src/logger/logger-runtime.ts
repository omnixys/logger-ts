import { format } from "node:util";
import { LogLevel, type LogDTO } from "@omnixys/contracts-ts";
import type { Logger } from "pino";
import type { AsyncBatchLogger } from "../batch/async-batch-logger.js";
import type {
  LoggerModuleOptions,
  LoggerSinkLevel,
} from "../core/logger.options.js";
import {
  redactForLog,
  sanitizeLogMetadata,
} from "../diagnostics/log-redaction.js";
import { isTransportLoggingSuppressed } from "../transport/transport-recursion.guard.js";
import { getCanonicalLogMetadata } from "./context-log-metadata.js";

const LEVEL_NUMBER: Record<Exclude<LoggerSinkLevel, "silent">, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

const LEVEL_NAME = new Map<number, LogLevel>([
  [10, LogLevel.trace],
  [20, LogLevel.debug],
  [30, LogLevel.info],
  [40, LogLevel.warn],
  [50, LogLevel.error],
  [60, LogLevel.error],
]);

export const LOG_RECORD = Symbol("@omnixys/logger-ts/log-record");

export interface InternalLogEnvelope {
  readonly log: LogDTO;
  readonly batch?: AsyncBatchLogger;
}

interface RuntimeState {
  options: LoggerModuleOptions;
  batch?: AsyncBatchLogger;
  pending: LogDTO[];
  preinitDropped: number;
}

const state: RuntimeState = {
  options: {
    serviceName: process.env.SERVICE_NAME ?? process.env.SERVICE ?? "unknown",
  },
  pending: [],
  preinitDropped: 0,
};

export function configureLoggerRuntime(options: LoggerModuleOptions): void {
  state.options = options;
}

export function attachLoggerBatch(batch: AsyncBatchLogger): void {
  state.batch = batch;
  const pending = state.pending.splice(0, state.pending.length);
  for (const log of pending) {
    try {
      batch.enqueue(log);
    } catch {
      state.preinitDropped += 1;
    }
  }
}

export function detachLoggerBatch(batch: AsyncBatchLogger): void {
  if (state.batch === batch) state.batch = undefined;
}

export function loggerRuntimeSinkDiagnostics() {
  return {
    preinitBuffered: state.pending.length,
    preinitDropped: state.preinitDropped,
    consoleLevel: resolveConsoleLevel(state.options),
    otelLevel: resolveOtelLevel(state.options),
  };
}

export function routePinoLog(
  logger: Logger,
  args: Parameters<Logger["info"]>,
  levelNumber: number,
): void {
  if (isTransportLoggingSuppressed()) return;

  const first = args[0];
  const envelope =
    typeof first === "object" && first !== null
      ? ((first as Record<PropertyKey, unknown>)[LOG_RECORD] as
          InternalLogEnvelope | undefined)
      : undefined;
  const log = envelope?.log ?? logDtoFromPino(logger, args, levelNumber);
  if (!log || !isEnabled(log.level, resolveOtelLevel(state.options))) return;

  const batch = envelope?.batch ?? state.batch;
  if (batch) {
    try {
      batch.enqueue(log);
    } catch {
      // Logging must never affect application control flow.
    }
    return;
  }

  const maxBufferSize = positiveInteger(
    state.options.batch?.maxBufferSize,
    1_000,
  );
  if (state.pending.length >= maxBufferSize) {
    state.preinitDropped += 1;
    if (state.options.batch?.overflowStrategy === "drop-newest") return;
    state.pending.shift();
  }
  state.pending.push(log);
}

export function shouldWriteConsole(levelNumber: number): boolean {
  const level = LEVEL_NAME.get(levelNumber);
  return (
    level !== undefined && isEnabled(level, resolveConsoleLevel(state.options))
  );
}

export function sanitizePinoConsoleArguments(
  args: Parameters<Logger["info"]>,
): Parameters<Logger["info"]> {
  return args.map((value) => redactForLog(value)) as Parameters<Logger["info"]>;
}

export function resolveConsoleLevel(
  options: LoggerModuleOptions,
): LoggerSinkLevel {
  const explicit = sinkLevel(process.env.LOG_CONSOLE_LEVEL);
  if (explicit) return explicit;
  if (options.console?.enabled === false) return "silent";
  if (options.console?.level) return options.console.level;

  const legacy = sinkLevel(process.env.LOG_LEVEL);
  if (legacy) return legacy;
  const environment = normalizedEnvironment(options.environment);
  if (environment === "test") return "silent";
  return isRestrictedEnvironment(environment) ? "info" : "trace";
}

export function resolveOtelLevel(
  options: LoggerModuleOptions,
): LoggerSinkLevel {
  const explicit = sinkLevel(process.env.LOG_OTEL_LEVEL);
  if (explicit) return explicit;
  if (options.otel?.enabled === false) return "silent";
  if (options.otel?.level) return options.otel.level;
  return normalizedEnvironment(options.environment) === "test"
    ? "silent"
    : "trace";
}

function logDtoFromPino(
  logger: Logger,
  args: Parameters<Logger["info"]>,
  levelNumber: number,
): LogDTO | undefined {
  const level = LEVEL_NAME.get(levelNumber);
  if (!level) return undefined;

  const bindings = logger.bindings() as Record<string, unknown>;
  const { message, metadata } = normalizePinoArguments(args);
  const contextMetadata = getCanonicalLogMetadata();
  const boundService = stringValue(bindings.service);
  const service =
    !boundService || boundService === "unknown"
      ? state.options.serviceName
      : boundService;

  return {
    level,
    message,
    service,
    timestamp: new Date().toISOString(),
    metadata: sanitizeLogMetadata({
      ...bindings,
      ...metadata,
      clazz: bindings.class ?? bindings.clazz ?? "application",
      ...contextMetadata,
      ...(levelNumber === 60 ? { originalSeverity: "fatal" } : {}),
    }),
    source: stringValue(bindings.source),
    traceContext: {
      traceId: contextMetadata.traceId,
      spanId: contextMetadata.spanId,
    },
  };
}

function normalizePinoArguments(args: Parameters<Logger["info"]>): {
  message: string;
  metadata: Record<string, unknown>;
} {
  const [first, second, ...rest] = args as unknown[];
  if (typeof first === "object" && first !== null && !Array.isArray(first)) {
    const metadata = first instanceof Error ? { error: first } : first;
    const rawMessage =
      typeof second === "string"
        ? second
        : first instanceof Error
          ? first.message
          : "Log entry";
    return {
      message: safeMessage(format(rawMessage, ...rest)),
      metadata: sanitizeLogMetadata(metadata as Record<string, unknown>),
    };
  }

  const rawMessage =
    typeof first === "string" ? first : String(first ?? "Log entry");
  const trailingMetadata =
    typeof second === "object" && second !== null && !Array.isArray(second)
      ? (second as Record<string, unknown>)
      : {};
  const formatArgs =
    Object.keys(trailingMetadata).length > 0
      ? rest
      : (args.slice(1) as unknown[]);
  return {
    message: safeMessage(format(rawMessage, ...formatArgs)),
    metadata: sanitizeLogMetadata(trailingMetadata),
  };
}

function safeMessage(value: string): string {
  const redacted = redactForLog(value);
  return typeof redacted === "string" ? redacted : "[Redacted log]";
}

function isEnabled(level: LogLevel, minimum: LoggerSinkLevel): boolean {
  if (minimum === "silent") return false;
  return LEVEL_NUMBER[level] >= LEVEL_NUMBER[minimum];
}

function normalizedEnvironment(explicit?: string): string {
  return (
    explicit ??
    process.env.DEPLOYMENT_ENVIRONMENT ??
    process.env.NODE_ENV ??
    "local"
  )
    .trim()
    .toLowerCase();
}

function isRestrictedEnvironment(environment: string): boolean {
  return (
    environment === "staging" ||
    environment === "prod" ||
    environment === "production"
  );
}

function sinkLevel(value: string | undefined): LoggerSinkLevel | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized === "silent" ||
    normalized === "trace" ||
    normalized === "debug" ||
    normalized === "info" ||
    normalized === "warn" ||
    normalized === "error"
    ? normalized
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value !== undefined && value > 0
    ? value
    : fallback;
}
