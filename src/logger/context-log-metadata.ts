import { ContextAccessor } from "@omnixys/context-ts/accessor";

export interface CanonicalLogMetadata {
  readonly requestId: string;
  readonly correlationId: string;
  readonly tenantId?: string;
  readonly actorId?: string;
  readonly userId?: string;
  readonly traceId?: string;
  readonly spanId?: string;
}

/** Reads request metadata without creating or mutating context. */
export function getCanonicalLogMetadata(): CanonicalLogMetadata {
  const context = ContextAccessor.get();

  return {
    requestId: context?.requestId ?? "unscoped",
    correlationId:
      context?.correlationId ?? context?.requestId ?? "unscoped",
    tenantId: context?.tenant?.tenantId,
    actorId: context?.principal?.actorId,
    userId:
      context?.principal?.userId ??
      context?.principal?.actorId ??
      context?.principal?.subject,
    traceId: context?.trace?.traceId,
    spanId: context?.trace?.spanId,
  };
}
