import assert from "node:assert/strict";
import test from "node:test";
import { getLogger } from "../dist/logger/get-logger.js";
import { ScopedLogger } from "../dist/logger/scoped-logger.js";
import {
  attachLoggerBatch,
  configureLoggerRuntime,
  detachLoggerBatch,
  resolveConsoleLevel,
  resolveOtelLevel,
  sanitizePinoConsoleArguments,
} from "../dist/logger/logger-runtime.js";

test("environment defaults keep console and OTLP levels independent", () => {
  withoutLevelEnvironment(() => {
    for (const environment of ["dev", "development", "local"]) {
      assert.equal(
        resolveConsoleLevel({ serviceName: "test", environment }),
        "trace",
      );
      assert.equal(
        resolveOtelLevel({ serviceName: "test", environment }),
        "trace",
      );
    }

    for (const environment of ["staging", "prod", "production"]) {
      assert.equal(
        resolveConsoleLevel({ serviceName: "test", environment }),
        "info",
      );
      assert.equal(
        resolveOtelLevel({ serviceName: "test", environment }),
        "trace",
      );
    }

    assert.equal(
      resolveConsoleLevel({ serviceName: "test", environment: "test" }),
      "silent",
    );
    assert.equal(
      resolveOtelLevel({ serviceName: "test", environment: "test" }),
      "silent",
    );
  });
});

test("explicit sink levels override environment defaults independently", () => {
  withEnvironment(
    { LOG_CONSOLE_LEVEL: "warn", LOG_OTEL_LEVEL: "debug", LOG_LEVEL: "error" },
    () => {
      const options = { serviceName: "test", environment: "production" };
      assert.equal(resolveConsoleLevel(options), "warn");
      assert.equal(resolveOtelLevel(options), "debug");
    },
  );
});

test("console arguments use the same recursive redaction as OTLP", () => {
  const [metadata, message] = sanitizePinoConsoleArguments([
    { password: "must-not-leak", nested: { apiKey: "also-secret" } },
    "authorization=Bearer secret-value",
  ]);

  assert.deepEqual(metadata, {
    password: "[REDACTED]",
    nested: { apiKey: "[REDACTED]" },
  });
  assert.equal(message, "authorization=[REDACTED]");
});

test("legacy getLogger records are drained to the OTLP batch exactly once", () => {
  withoutLevelEnvironment(() => {
    const records = [];
    const batch = { enqueue: (record) => records.push(record) };
    configureLoggerRuntime({
      serviceName: "orders",
      environment: "production",
    });

    const logger = getLogger("OrderWorker");
    logger.warn(
      { orderId: "order-1", password: "must-not-leak" },
      "order_delayed",
    );
    assert.equal(records.length, 0);

    attachLoggerBatch(batch);
    assert.equal(records.length, 1);
    assert.equal(records[0].message, "order_delayed");
    assert.equal(records[0].metadata.orderId, "order-1");
    assert.equal(records[0].metadata.password, "[REDACTED]");
    assert.equal(records[0].metadata.clazz, "OrderWorker");
    detachLoggerBatch(batch);
  });
});

test("pre-init OTLP buffering is bounded", () => {
  withoutLevelEnvironment(() => {
    const records = [];
    const batch = { enqueue: (record) => records.push(record) };
    configureLoggerRuntime({
      serviceName: "orders",
      environment: "production",
      console: { enabled: false },
      batch: { maxBufferSize: 2, overflowStrategy: "drop-newest" },
    });

    const logger = getLogger("Startup");
    logger.info("first");
    logger.info("second");
    logger.info("dropped");
    attachLoggerBatch(batch);

    assert.deepEqual(
      records.map(({ message }) => message),
      ["first", "second"],
    );
    detachLoggerBatch(batch);
  });
});

test("ScopedLogger routes one record through its configured batch", () => {
  withoutLevelEnvironment(() => {
    const records = [];
    const batch = { enqueue: (record) => records.push(record) };
    configureLoggerRuntime({
      serviceName: "orders",
      environment: "production",
    });

    const logger = new ScopedLogger(
      "OrderService",
      { serviceName: "orders" },
      batch,
    );
    logger.debug("order_loaded", { orderId: "order-1" });

    assert.equal(records.length, 1);
    assert.equal(records[0].message, "order_loaded");
    assert.equal(records[0].metadata.orderId, "order-1");
  });
});

function withoutLevelEnvironment(callback) {
  return withEnvironment(
    {
      LOG_CONSOLE_LEVEL: undefined,
      LOG_OTEL_LEVEL: undefined,
      LOG_LEVEL: undefined,
    },
    callback,
  );
}

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
