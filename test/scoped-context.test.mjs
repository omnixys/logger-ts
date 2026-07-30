import assert from "node:assert/strict";
import test from "node:test";
import { ContextAccessor } from "@omnixys/context-ts";
import { ScopedLogger } from "../dist/logger/scoped-logger.js";

test("ScopedLogger uses exactly the canonical context identifiers", () => {
  let captured;
  const batch = { enqueue: (record) => (captured = record) };
  const logger = new ScopedLogger(
    "OrdersService",
    { serviceName: "orders" },
    batch,
  );

  ContextAccessor.run(
    {
      requestId: "request-1",
      correlationId: "correlation-1",
      startedAtEpochMs: Date.now(),
      principal: {
        subject: "subject-1",
        actorId: "actor-1",
        userId: "user-1",
        roles: [],
      },
      tenant: {
        tenantId: "tenant-1",
        source: "principal",
        verified: true,
      },
      client: {},
      transport: { type: "http" },
      trace: { traceId: "trace-1", spanId: "span-1" },
    },
    () => logger.info("created order"),
  );

  assert.deepEqual(
    {
      requestId: captured.metadata.requestId,
      correlationId: captured.metadata.correlationId,
      tenantId: captured.metadata.tenantId,
      actorId: captured.metadata.actorId,
      userId: captured.metadata.userId,
      traceId: captured.metadata.traceId,
      spanId: captured.metadata.spanId,
    },
    {
      requestId: "request-1",
      correlationId: "correlation-1",
      tenantId: "tenant-1",
      actorId: "actor-1",
      userId: "user-1",
      traceId: "trace-1",
      spanId: "span-1",
    },
  );
});

test("caller metadata cannot replace canonical identifiers", () => {
  let captured;
  const logger = new ScopedLogger(
    "OrdersService",
    { serviceName: "orders" },
    { enqueue: (record) => (captured = record) },
  );

  ContextAccessor.run(
    { requestId: "canonical-request", correlationId: "canonical-correlation" },
    () =>
      logger.info("created order", {
        requestId: "caller-request",
        correlationId: "caller-correlation",
      }),
  );

  assert.equal(captured.metadata.requestId, "canonical-request");
  assert.equal(captured.metadata.correlationId, "canonical-correlation");
});
