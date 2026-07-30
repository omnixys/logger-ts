import assert from "node:assert/strict";
import test from "node:test";
import { ContextAccessor } from "@omnixys/context-ts";
import { TraceRunner } from "@omnixys/observability-ts";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { context, trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { ScopedLogger } from "../dist/logger/scoped-logger.js";

test("parallel logs and spans use identical canonical identifiers", async () => {
  const contextManager = new AsyncLocalStorageContextManager().enable();
  context.setGlobalContextManager(contextManager);
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  trace.setGlobalTracerProvider(provider);

  const records = [];
  const logger = new ScopedLogger(
    "OrderWorker",
    { serviceName: "orders" },
    { enqueue: (record) => records.push(record) },
  );

  await Promise.all(
    ["first", "second", "third"].map((requestId, index) =>
      ContextAccessor.run(baseSnapshot(requestId), () =>
        TraceRunner.run(`process ${requestId}`, async () => {
          await new Promise((resolve) => setTimeout(resolve, (3 - index) * 3));
          logger.info("processed order");
        }),
      ),
    ),
  );

  await provider.forceFlush();
  const spansByRequest = new Map(
    exporter
      .getFinishedSpans()
      .map((span) => [span.attributes["request.id"], span]),
  );

  assert.equal(records.length, 3);
  for (const record of records) {
    const span = spansByRequest.get(record.metadata.requestId);
    assert.ok(span, `missing span for ${record.metadata.requestId}`);
    assert.equal(record.metadata.correlationId, span.attributes["correlation.id"]);
    assert.equal(record.metadata.tenantId, span.attributes["tenant.id"]);
    assert.equal(record.metadata.actorId, span.attributes["actor.id"]);
    assert.equal(record.metadata.traceId, span.spanContext().traceId);
    assert.equal(record.metadata.spanId, span.spanContext().spanId);
  }

  assert.equal(ContextAccessor.get(), undefined);
  await provider.shutdown();
  contextManager.disable();
  context.disable();
  trace.disable();
});

function baseSnapshot(requestId) {
  return {
    requestId,
    correlationId: `correlation-${requestId}`,
    startedAtEpochMs: Date.now(),
    principal: {
      subject: `subject-${requestId}`,
      actorId: `actor-${requestId}`,
      roles: [],
    },
    tenant: {
      tenantId: `tenant-${requestId}`,
      source: "principal",
      verified: true,
    },
    client: {},
    transport: { type: "job", operation: "processOrder" },
  };
}
