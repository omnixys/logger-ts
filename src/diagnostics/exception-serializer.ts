import { getErrorDefinition } from "@omnixys/contracts";
import { redactForLog } from "./log-redaction.js";

export interface SerializedException {
  readonly type: string;
  readonly message: string;
  readonly stacktrace?: string;
  readonly code: string;
  readonly summary: string;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly source?: {
    readonly file?: string;
    readonly line?: number;
    readonly column?: number;
    readonly function?: string;
  };
  readonly diagnostics?: unknown;
  readonly dependency?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
}

interface ErrorLike {
  readonly code?: unknown;
  readonly summary?: unknown;
  readonly httpStatus?: unknown;
  readonly retryable?: unknown;
  readonly diagnostics?: unknown;
}

export function serializeExceptionForLog(
  error: unknown,
  fallbackCode = "INTERNAL_SERVER_ERROR",
): SerializedException {
  const nativeError =
    error instanceof Error ? error : new Error(String(error ?? "Unknown error"));
  const candidate = nativeError as Error & ErrorLike;
  const code =
    typeof candidate.code === "string" ? candidate.code : fallbackCode;
  const definition = getErrorDefinition(code);
  const source = firstApplicationCallsite(nativeError.stack);

  return Object.freeze({
    type: nativeError.name || "Error",
    message: safeText(nativeError.message),
    stacktrace: safeText(nativeError.stack),
    code,
    summary:
      typeof candidate.summary === "string"
        ? candidate.summary
        : definition.summary,
    httpStatus:
      typeof candidate.httpStatus === "number"
        ? candidate.httpStatus
        : definition.httpStatus,
    retryable:
      typeof candidate.retryable === "boolean"
        ? candidate.retryable
        : definition.retryable,
    source,
    diagnostics:
      candidate.diagnostics === undefined
        ? undefined
        : redactForLog(candidate.diagnostics),
    dependency: serializeDependencyError(nativeError),
    cause:
      nativeError.cause === undefined
        ? undefined
        : serializeCause(nativeError.cause, 0),
  });
}

function serializeCause(value: unknown, depth: number): unknown {
  if (depth >= 6) return "[Truncated]";
  if (!(value instanceof Error)) return redactForLog(value, { maxDepth: 6 - depth });
  const candidate = value as Error & ErrorLike;
  return {
    type: value.name,
    message: safeText(value.message),
    stacktrace: safeText(value.stack),
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    diagnostics:
      candidate.diagnostics === undefined
        ? undefined
        : redactForLog(candidate.diagnostics, { maxDepth: 6 - depth }),
    dependency: serializeDependencyError(value),
    cause:
      value.cause === undefined
        ? undefined
        : serializeCause(value.cause, depth + 1),
  };
}

function safeText(value: string): string;
function safeText(value: undefined): undefined;
function safeText(value: string | undefined): string | undefined;
function safeText(value: string | undefined): string | undefined {
  const redacted = redactForLog(value);
  return typeof redacted === "string" ? redacted : undefined;
}

function serializeDependencyError(
  error: Error,
): Readonly<Record<string, unknown>> | undefined {
  const candidate = error as Error & Record<string, unknown>;

  if (candidate.isAxiosError === true || error.name === "AxiosError") {
    const config = record(candidate.config);
    const response = record(candidate.response);
    const oauth = record(response?.data);
    const parsedUrl = safeUrl(config?.url);
    return compact({
      system: "http",
      code: string(candidate.code),
      upstreamStatus: number(response?.status),
      method: string(config?.method)?.toUpperCase(),
      host: parsedUrl?.host,
      path: parsedUrl?.pathname,
      oauthError: string(oauth?.error),
    });
  }

  if (
    error.name.includes("Prisma") ||
    (typeof candidate.code === "string" && /^P\\d{4}$/.test(candidate.code))
  ) {
    const meta = record(candidate.meta);
    return compact({
      system: "prisma",
      code: string(candidate.code),
      model: string(meta?.modelName),
      operation: string(meta?.operation),
      constraint: safeConstraint(meta?.target),
    });
  }

  const system = dependencySystem(error.name, candidate);
  if (!system) return undefined;
  return compact({
    system,
    code: string(candidate.code),
    operation: string(candidate.operation),
    topic: string(candidate.topic),
    bucket: string(candidate.bucket),
    channel: string(candidate.channel),
    status: string(candidate.status) ?? number(candidate.status),
  });
}

function dependencySystem(
  name: string,
  candidate: Record<string, unknown>,
): string | undefined {
  const text = `${name} ${String(candidate.system ?? "")}`.toLowerCase();
  if (text.includes("kafka")) return "kafka";
  if (text.includes("valkey") || text.includes("redis")) return "valkey";
  if (text.includes("minio") || text.includes("s3")) return "minio";
  if (text.includes("smtp") || text.includes("mail")) return "email";
  return undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function safeUrl(value: unknown): URL | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function safeConstraint(value: unknown): unknown {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string").slice(0, 10);
  }
  return undefined;
}

function compact(
  value: Record<string, unknown>,
): Readonly<Record<string, unknown>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined),
    ),
  );
}

function firstApplicationCallsite(
  stack: string | undefined,
): SerializedException["source"] {
  if (!stack) return undefined;
  for (const line of stack.split("\n").slice(1)) {
    if (
      line.includes("node:internal") ||
      line.includes("/node_modules/") ||
      line.includes("\\node_modules\\")
    ) {
      continue;
    }
    const match =
      line.match(/^\s*at\s+(.+?)\s+\((.+):(\d+):(\d+)\)\s*$/) ??
      line.match(/^\s*at\s+()(.+):(\d+):(\d+)\s*$/);
    if (!match) continue;
    return {
      function: match[1] || undefined,
      file: match[2],
      line: Number(match[3]),
      column: Number(match[4]),
    };
  }
  return undefined;
}
