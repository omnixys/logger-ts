import assert from "node:assert/strict";
import test from "node:test";
import { ScopedLogger } from "../dist/logger/scoped-logger.js";

function capturedLogger(source) {
  const records = [];
  const logger = new ScopedLogger(
    "SecurityService",
    { serviceName: "authentication" },
    { enqueue: (record) => records.push(record) },
    {},
    undefined,
    source,
  );
  return { records, logger };
}

test("ScopedLogger source lands on the LogDTO record", () => {
  const { records, logger } = capturedLogger("package:@omnixys/security-ts");
  logger.info("rate limit enforced", { rule: "login" });

  assert.equal(records[0].source, "package:@omnixys/security-ts");
});

test("source is absent when the logger is created without one", () => {
  const { records, logger } = capturedLogger(undefined);
  logger.info("no provenance");

  assert.equal(records[0].source, undefined);
  assert.equal("source" in records[0], false);
});

test("child(logger) inherits the source when no explicit source is given", () => {
  const { records, logger } = capturedLogger("package:@omnixys/cache-ts");
  logger.child("worker", { queue: "orders" }).info("polled");

  assert.equal(records[0].source, "package:@omnixys/cache-ts");
});

test("explicit source on a child overrides the parent source", () => {
  const { records, logger } = capturedLogger("service:authentication");
  logger.child("repo", {}, "package:@omnixys/security-ts").info("lookup");

  assert.equal(records[0].source, "package:@omnixys/security-ts");
});

test("OmnixysLogger.log(context, source) propagates the source", async () => {
  const { OmnixysLogger } = await import("../dist/logger/omnixys-logger.js");
  const records = [];
  const logger = new OmnixysLogger(
    { serviceName: "authentication" },
    { enqueue: (record) => records.push(record) },
  );
  logger.log("JwtStrategy", "package:@omnixys/security-ts").debug("validated");

  assert.equal(records[0].source, "package:@omnixys/security-ts");
});
