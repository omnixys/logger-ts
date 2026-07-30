import type { LogDTO } from "@omnixys/contracts-ts";
import {
  logs,
  SeverityNumber,
  type AnyValue,
  type LogAttributes,
} from "@opentelemetry/api-logs";
import type { LogTransport } from "./log-transport.interface.js";

const SENSITIVE_KEY = /(?:authorization|cookie|password|secret|token|api[_-]?key)/i;

const severityNumbers = {
  trace: SeverityNumber.TRACE,
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
} as const;

/** Bridges the Omnixys logger API into the globally configured OTel log provider. */
export class OtelLogTransport implements LogTransport {
  async send(log: LogDTO): Promise<void> {
    const logger = logs.getLogger("@omnixys/logger-ts");
    logger.emit({
      severityNumber: severityNumbers[log.level],
      severityText: log.level.toUpperCase(),
      body: log.message,
      attributes: canonicalAttributes(log),
    });
  }
}

function canonicalAttributes(log: LogDTO): LogAttributes {
  const metadata = log.metadata ?? {};
  const attributes: LogAttributes = {
    "logger.name": stringValue(metadata.clazz ?? metadata.class) ?? "application",
  };

  copy(attributes, "operation", log.operation);
  copy(attributes, "request.id", metadata.requestId);
  copy(attributes, "correlation.id", metadata.correlationId);
  copy(attributes, "actor.id", metadata.actorId);
  copy(attributes, "tenant.id", metadata.tenantId);
  copy(attributes, "organization.id", metadata.organizationId);
  copy(attributes, "component", metadata.component);
  copyException(attributes, metadata.error ?? metadata.exception);

  for (const [key, value] of Object.entries(metadata)) {
    if (
      SENSITIVE_KEY.test(key) ||
      key === "traceId" ||
      key === "spanId" ||
      key === "error" ||
      key === "exception" ||
      key in attributes
    ) {
      continue;
    }
    const normalized = toAnyValue(value);
    if (normalized !== undefined) attributes[key] = normalized;
  }

  return attributes;
}

function copy(
  attributes: LogAttributes,
  key: string,
  value: unknown,
): void {
  const normalized = toAnyValue(value);
  if (normalized !== undefined) attributes[key] = normalized;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toAnyValue(value: unknown): AnyValue | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) return value.message;
  if (value === null || value === undefined) return undefined;

  try {
    return JSON.stringify(value, (key, nested) =>
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : nested,
    );
  } catch {
    return "[Unserializable]";
  }
}

function copyException(attributes: LogAttributes, value: unknown): void {
  if (value instanceof Error) {
    copy(attributes, "exception.type", value.name);
    copy(attributes, "exception.message", value.message);
    copy(attributes, "exception.stacktrace", value.stack);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const error = value as Record<string, unknown>;
  copy(attributes, "exception.type", error.name ?? error.type);
  copy(attributes, "exception.message", error.message);
  copy(attributes, "exception.stacktrace", error.stack ?? error.stacktrace);
}
