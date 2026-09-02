import process from 'node:process';

const REDACTED_VALUE = '[REDACTED]';

const SENSITIVE_KEY =
  /(?:authorization|cookie|password|passwd|secret|token|credential|private[._-]?key|api[._-]?key|access[._-]?key|encryption[._-]?key|jwe[._-]?key|jws[._-]?keys?|hmac[._-]?secret|fingerprint[._-]?secret|client[._-]?secret|connection[._-]?string|database[._-]?url)/i;

const SENSITIVE_STRING =
  /((?:authorization|cookie|password|passwd|secret|token|credential|private[._-]?key|api[._-]?key|access[._-]?key|encryption[._-]?key|jwe[._-]?key|jws[._-]?keys?|hmac[._-]?secret|fingerprint[._-]?secret|client[._-]?secret|connection[._-]?string|database[._-]?url)\s*[:=]\s*)(?:bearer\s+)?[^\s,;]+/gi;

const UNREDACTED_ENVIRONMENTS = new Set([
  'local',
  'dev',
  'development',
  'staging'
]);

export interface RedactionOptions {
  readonly maxDepth?: number;
  readonly maxArrayLength?: number;

  /**
   * Überschreibt die automatische NODE_ENV-basierte Entscheidung.
   *
   * true  -> Secrets werden redacted.
   * false -> Secrets bleiben sichtbar.
   */
  readonly redactSensitive?: boolean;

  /**
   * Optionales NODE_ENV-Override.
   *
   * Wird hauptsächlich für Tests benötigt.
   */
  readonly nodeEnv?: string;
}

export function shouldRedactLogs(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  const normalizedEnvironment = nodeEnv?.trim().toLowerCase();

  if (!normalizedEnvironment) {
    return true;
  }

  return !UNREDACTED_ENVIRONMENTS.has(normalizedEnvironment);
}

export function isSensitiveLogKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

export function redactForLog(
  value: unknown,
  options: RedactionOptions = {},
): unknown {
  const redactSensitive =
    options.redactSensitive ??
    shouldRedactLogs(options.nodeEnv);

  return sanitize(
    value,
    0,
    new WeakSet<object>(),
    options.maxDepth ?? 8,
    options.maxArrayLength ?? 100,
    redactSensitive,
  );
}

export function sanitizeLogMetadata(
  metadata: Readonly<Record<string, unknown>>,
  options: RedactionOptions = {},
): Record<string, unknown> {
  const sanitized = redactForLog(metadata, options);

  return sanitized &&
    typeof sanitized === 'object' &&
    !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {};
}

function sanitize(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
  maxDepth: number,
  maxArrayLength: number,
  redactSensitive: boolean,
): unknown {
  if (depth > maxDepth) {
    return '[Truncated]';
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value, redactSensitive);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (
    typeof value === 'function' ||
    typeof value === 'symbol'
  ) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== 'object') {
    return String(value);
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  if (value instanceof Error) {
    return sanitizeError(
      value,
      depth,
      seen,
      maxDepth,
      maxArrayLength,
      redactSensitive,
    );
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value
      .slice(0, maxArrayLength)
      .map((entry) =>
        sanitize(
          entry,
          depth + 1,
          seen,
          maxDepth,
          maxArrayLength,
          redactSensitive,
        ),
      );
  }

  const safe: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (
      redactSensitive &&
      isSensitiveLogKey(key)
    ) {
      safe[key] = REDACTED_VALUE;
      continue;
    }

    const sanitized = sanitize(
      entry,
      depth + 1,
      seen,
      maxDepth,
      maxArrayLength,
      redactSensitive,
    );

    if (sanitized !== undefined) {
      safe[key] = sanitized;
    }
  }

  return safe;
}

function sanitizeString(
  value: string,
  redactSensitive: boolean,
): string {
  if (!redactSensitive) {
    return value;
  }

  return value.replace(
    SENSITIVE_STRING,
    `$1${REDACTED_VALUE}`,
  );
}

function sanitizeError(
  error: Error,
  depth: number,
  seen: WeakSet<object>,
  maxDepth: number,
  maxArrayLength: number,
  redactSensitive: boolean,
): Record<string, unknown> {
  if (seen.has(error)) {
    return {
      name: error.name,
      message: '[Circular]',
    };
  }

  seen.add(error);

  const candidate = error as Error & Record<string, unknown>;

  const safe: Record<string, unknown> = {
    name: error.name,
    message: sanitizeString(
      error.message,
      redactSensitive,
    ),
  };

  if (error.stack !== undefined) {
    safe.stack = sanitizeString(
      error.stack,
      redactSensitive,
    );
  }

  for (const key of [
    'code',
    'summary',
    'httpStatus',
    'retryable',
    'requestId',
    'correlationId',
    'traceId',
    'metadata',
    'diagnostics',
  ]) {
    if (!(key in candidate)) {
      continue;
    }

    if (
      redactSensitive &&
      isSensitiveLogKey(key)
    ) {
      safe[key] = REDACTED_VALUE;
      continue;
    }

    const sanitized = sanitize(
      candidate[key],
      depth + 1,
      seen,
      maxDepth,
      maxArrayLength,
      redactSensitive,
    );

    if (sanitized !== undefined) {
      safe[key] = sanitized;
    }
  }

  if (error.cause !== undefined) {
    safe.cause = sanitize(
      error.cause,
      depth + 1,
      seen,
      maxDepth,
      maxArrayLength,
      redactSensitive,
    );
  }

  return safe;
}