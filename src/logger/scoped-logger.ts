import { format } from "util";
import type { AsyncBatchLogger } from "../batch/async-batch-logger.js";
import type { LoggerModuleOptions } from "../core/logger.options.js";

import { getLogger } from "./get-logger.js";
import {
  closeParentLogger,
  flushParentLogger,
  isParentLoggerClosed,
} from "./logger.config.js";
import { isTransportLoggingSuppressed } from "../transport/transport-recursion.guard.js";
import { getCanonicalLogMetadata } from "./context-log-metadata.js";
import { LogDTO, LogLevel } from "@omnixys/contracts-ts";
import {
  redactForLog,
  sanitizeLogMetadata,
} from "../diagnostics/log-redaction.js";

const levelMap = {
  trace: "trace",
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
} as const;

type PinoLevel = keyof typeof levelMap;
export type LoggerMetadata = Readonly<Record<string, unknown>>;

export class ScopedLogger {
  private readonly pino;
  private readonly baseMetadata: LoggerMetadata;

  constructor(
    private readonly clazz: string,
    private readonly options: LoggerModuleOptions,
    private readonly batch: AsyncBatchLogger,
    metadata: LoggerMetadata = {},
    private readonly component?: string,
  ) {
    this.pino = getLogger(clazz, "class");
    this.baseMetadata = Object.freeze(toMetadataRecord(metadata));
  }

  child(component: string, metadata?: LoggerMetadata): ScopedLogger;
  child(metadata: LoggerMetadata): ScopedLogger;
  child(
    componentOrMetadata: string | LoggerMetadata,
    metadata: LoggerMetadata = {},
  ): ScopedLogger {
    const component =
      typeof componentOrMetadata === "string"
        ? joinComponent(this.component, componentOrMetadata)
        : this.component;
    const childMetadata =
      typeof componentOrMetadata === "string"
        ? metadata
        : componentOrMetadata;

    return new ScopedLogger(
      this.clazz,
      this.options,
      this.batch,
      { ...this.baseMetadata, ...toMetadataRecord(childMetadata) },
      component,
    );
  }

  withMetadata(metadata: LoggerMetadata): ScopedLogger {
    return this.child(metadata);
  }

  async flush(): Promise<void> {
    await this.batch.flush();
    await flushParentLogger();
  }

  async close(): Promise<void> {
    await this.batch.close();
    await closeParentLogger();
  }

  info(message: string, ...args: unknown[]) {
    this.log(LogLevel.info, message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.log(LogLevel.error, message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.log(LogLevel.warn, message, ...args);
  }

  debug(message: string, ...args: unknown[]) {
    this.log(LogLevel.debug, message, ...args);
  }

  trace(message: string, ...args: unknown[]) {
    this.log(LogLevel.trace, message, ...args);
  }

  private log(level: LogLevel, message: string, ...args: unknown[]) {
    if (isParentLoggerClosed() || isTransportLoggingSuppressed()) return;

    let metadata: Record<string, unknown> | undefined = {};
    let formatArgs = args;

    const hasPlaceholders = /%[sdifoO]/.test(message);

    if (
      args.length > 0 &&
      typeof args[args.length - 1] === "object" &&
      args[args.length - 1] !== null &&
      !Array.isArray(args[args.length - 1]) &&
      !hasPlaceholders // 🔥 WICHTIG
    ) {
      metadata = toMetadataRecord(args[args.length - 1]);
      formatArgs = args.slice(0, -1);
    }

    const normalizedArgs = formatArgs.map(normalizeObject);

    const formattedMessage = format(message, ...normalizedArgs);
    const redactedMessage = redactForLog(formattedMessage);
    const msg =
      typeof redactedMessage === "string" ? redactedMessage : "[Redacted log]";
    const extractedArgs = mapArgsToMetadata(message, formatArgs);

    const contextMetadata = getCanonicalLogMetadata();

    metadata = sanitizeLogMetadata({
      ...this.baseMetadata,
      ...extractedArgs,
      ...metadata,
      clazz: this.clazz,
      ...(this.component ? { component: this.component } : {}),
      ...contextMetadata,
    });

    const log: LogDTO = {
      level,
      message: msg,
      service: this.options.serviceName,
      timestamp: new Date().toISOString(),
      metadata,
      traceContext: {
        traceId: contextMetadata.traceId,
        spanId: contextMetadata.spanId,
      },
    };

    const pinoLevel: PinoLevel = level;

    try {
      this.pino[pinoLevel](
        {
          class: this.clazz,
          service: this.options.serviceName,
          ...metadata,
        },
        msg,
      );
    } catch {
      // Pino transport failure must not affect application control flow.
    }

    try {
      this.batch.enqueue(log);
    } catch {
      // Custom transports and compatibility batch implementations are isolated.
    }
  }
}

function safeSerialize(value: unknown): unknown {
  return redactForLog(value);
}

function extractKeysFromMessage(message: string): string[] {
  const keys: string[] = [];

  // matches: actor=%s, name=%d, user=%o
  const regex = /(\w+)=\s*%[sdifoO]/g;

  let match;
  while ((match = regex.exec(message)) !== null) {
    keys.push(match[1]);
  }

  return keys;
}

function mapArgsToMetadata(
  message: string,
  args: unknown[],
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  const keys = extractKeysFromMessage(message);

  args.forEach((arg, index) => {
    const key = keys[index] ?? `arg${index}`;

    if (typeof arg === "object" && arg !== null) {
      metadata[key] = safeSerialize(arg);
    } else {
      metadata[key] = arg;
    }
  });

  return metadata;
}

function normalizeObject(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return redactForLog(value);
  }
  return redactForLog(value);
}

function toMetadataRecord(value: unknown): Record<string, unknown> {
  const serialized = safeSerialize(value);
  return serialized && typeof serialized === "object" && !Array.isArray(serialized)
    ? (serialized as Record<string, unknown>)
    : {};
}

function joinComponent(parent: string | undefined, child: string): string {
  return parent ? `${parent}.${child}` : child;
}
