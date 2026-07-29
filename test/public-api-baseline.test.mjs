import assert from "node:assert/strict";
import test from "node:test";
import * as loggerPackage from "../dist/index.js";

test("preserves the established root exports", () => {
  assert.deepEqual(
    Object.keys(loggerPackage).sort(),
    [
      "ExceptionReporter",
      "LoggerModule",
      "LoggingInterceptor",
      "OmnixysLogger",
      "ScopedLogger",
      "getLogger",
      "redactForLog",
      "sanitizeLogMetadata",
      "serializeExceptionForLog",
    ],
  );
});

test("preserves synchronous scoped logger method signatures", () => {
  const methods = ["info", "error", "warn", "debug", "trace"];

  for (const method of methods) {
    assert.equal(typeof loggerPackage.ScopedLogger.prototype[method], "function");
  }
});
