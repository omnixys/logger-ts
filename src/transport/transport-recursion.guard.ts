import { context, createContextKey } from "@opentelemetry/api";

const TRANSPORT_LOGGING = createContextKey("@omnixys/logger-ts/transport-logging");
let synchronousTransportDepth = 0;

export function isTransportLoggingSuppressed(): boolean {
  return (
    synchronousTransportDepth > 0 ||
    context.active().getValue(TRANSPORT_LOGGING) === true
  );
}

export function runWithTransportLoggingSuppressed<T>(fn: () => T): T {
  const suppressedContext = context.active().setValue(TRANSPORT_LOGGING, true);
  synchronousTransportDepth += 1;

  try {
    return context.with(suppressedContext, fn);
  } finally {
    synchronousTransportDepth -= 1;
  }
}
