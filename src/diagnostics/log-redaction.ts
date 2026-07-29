const SENSITIVE_KEY =
  /(?:authorization|cookie|password|passwd|secret|token|credential|private.?key|api.?key|connection.?string|database.?url)/i;

export interface RedactionOptions {
  readonly maxDepth?: number;
  readonly maxArrayLength?: number;
}

export function redactForLog(
  value: unknown,
  options: RedactionOptions = {},
): unknown {
  return sanitize(
    value,
    0,
    new WeakSet<object>(),
    options.maxDepth ?? 8,
    options.maxArrayLength ?? 100,
  );
}

export function sanitizeLogMetadata(
  metadata: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const sanitized = redactForLog(metadata);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {};
}

function sanitize(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
  maxDepth: number,
  maxArrayLength: number,
): unknown {
  if (depth > maxDepth) return "[Truncated]";
  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "string") return redactSensitiveString(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return sanitizeError(value, depth, seen, maxDepth, maxArrayLength);
  if (Array.isArray(value)) {
    return value
      .slice(0, maxArrayLength)
      .map((entry) =>
        sanitize(entry, depth + 1, seen, maxDepth, maxArrayLength),
      );
  }
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  const safe: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) {
      safe[key] = "[REDACTED]";
      continue;
    }
    const sanitized = sanitize(
      entry,
      depth + 1,
      seen,
      maxDepth,
      maxArrayLength,
    );
    if (sanitized !== undefined) safe[key] = sanitized;
  }
  return safe;
}

function redactSensitiveString(value: string): string {
  return value.replace(
    /((?:authorization|cookie|password|passwd|secret|token|credential|private.?key|api.?key|connection.?string|database.?url)\s*[:=]\s*)(?:bearer\s+)?[^\s,;]+/gi,
    "$1[REDACTED]",
  );
}

function sanitizeError(
  error: Error,
  depth: number,
  seen: WeakSet<object>,
  maxDepth: number,
  maxArrayLength: number,
): Record<string, unknown> {
  if (seen.has(error)) return { name: error.name, message: "[Circular]" };
  seen.add(error);
  const candidate = error as Error & Record<string, unknown>;
  const safe: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  for (const key of [
    "code",
    "summary",
    "httpStatus",
    "retryable",
    "requestId",
    "correlationId",
    "traceId",
    "metadata",
    "diagnostics",
  ]) {
    if (!(key in candidate)) continue;
    safe[key] = SENSITIVE_KEY.test(key)
      ? "[REDACTED]"
      : sanitize(
          candidate[key],
          depth + 1,
          seen,
          maxDepth,
          maxArrayLength,
        );
  }

  if (error.cause !== undefined) {
    safe.cause = sanitize(
      error.cause,
      depth + 1,
      seen,
      maxDepth,
      maxArrayLength,
    );
  }
  return safe;
}
