import assert from "node:assert/strict";
import test from "node:test";
import { ContextAccessor } from "@omnixys/context-ts";
import { ScopedLogger } from "../dist/logger/scoped-logger.js";

test("child loggers inherit metadata and compose component scopes", () => {
  const records = [];
  const root = new ScopedLogger(
    "OrdersService",
    { serviceName: "orders" },
    { enqueue: (record) => records.push(record) },
    { domain: "orders", owner: "platform" },
  );

  const repository = root.child("repository", { storage: "postgres" });
  const query = repository.child("query", { operation: "findById" });
  query.info("loaded order", { orderId: "order-1" });

  assert.deepEqual(
    {
      domain: records[0].metadata.domain,
      owner: records[0].metadata.owner,
      storage: records[0].metadata.storage,
      operation: records[0].metadata.operation,
      component: records[0].metadata.component,
      orderId: records[0].metadata.orderId,
    },
    {
      domain: "orders",
      owner: "platform",
      storage: "postgres",
      operation: "findById",
      component: "repository.query",
      orderId: "order-1",
    },
  );
});

test("sibling child metadata does not leak", () => {
  const records = [];
  const root = new ScopedLogger(
    "Worker",
    { serviceName: "orders" },
    { enqueue: (record) => records.push(record) },
  );

  root.child("first", { childId: "first" }).info("first log");
  root.child("second", { childId: "second" }).info("second log");

  assert.equal(records[0].metadata.childId, "first");
  assert.equal(records[0].metadata.component, "first");
  assert.equal(records[1].metadata.childId, "second");
  assert.equal(records[1].metadata.component, "second");
});

test("shared child logger preserves parallel request isolation", async () => {
  const records = [];
  const logger = new ScopedLogger(
    "Worker",
    { serviceName: "orders" },
    { enqueue: (record) => records.push(record) },
  ).child("processor", { queue: "orders" });

  await Promise.all(
    ["first", "second", "third"].map((requestId, index) =>
      ContextAccessor.run(
        { requestId, correlationId: `correlation-${requestId}` },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, (3 - index) * 3));
          logger.info("processed request");
        },
      ),
    ),
  );

  assert.deepEqual(
    records
      .map(({ metadata }) => [metadata.requestId, metadata.correlationId])
      .sort(),
    [
      ["first", "correlation-first"],
      ["second", "correlation-second"],
      ["third", "correlation-third"],
    ],
  );
  assert.ok(records.every(({ metadata }) => metadata.queue === "orders"));
});
