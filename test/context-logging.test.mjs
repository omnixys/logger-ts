import assert from "node:assert/strict";
import test from "node:test";
import { ContextAccessor } from "@omnixys/context-ts";
import { lastValueFrom, of, throwError } from "rxjs";
import { LoggingInterceptor } from "../dist/nest/logger.interceptor.js";

test("HTTP logging consumes canonical context instead of forwarded headers", async () => {
  const entries = [];
  const logger = {
    log: () => ({
      info: (message, metadata) => entries.push({ message, metadata }),
      debug: (message, metadata) => entries.push({ message, metadata }),
      error: (message, metadata) => entries.push({ message, metadata }),
    }),
  };
  const interceptor = new LoggingInterceptor(logger);
  const executionContext = {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({
        method: "GET",
        url: "/health",
        ip: "10.0.0.8",
        headers: {
          "user-agent": "untrusted-agent",
          "x-forwarded-for": "198.51.100.200",
        },
      }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  };

  await ContextAccessor.run(
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
      client: { ip: "203.0.113.10", userAgent: "canonical-agent" },
      transport: { type: "http" },
      trace: { traceId: "trace-1", spanId: "span-1" },
    },
    () =>
      lastValueFrom(
        interceptor.intercept(executionContext, { handle: () => of("ok") }),
      ),
  );

  assert.equal(entries[0].metadata.ip, "203.0.113.10");
  assert.equal(entries[0].metadata.userAgent, "canonical-agent");
  assert.equal(entries[0].metadata.userId, "user-1");
  assert.equal(entries[0].metadata.tenantId, "tenant-1");
  assert.equal(entries[0].metadata.correlationId, "correlation-1");
  assert.equal(entries[0].metadata.traceId, "trace-1");
});

test("readiness GET and HEAD request lifecycle logs use debug", async () => {
  for (const method of ["GET", "HEAD"]) {
    const entries = [];
    const interceptor = new LoggingInterceptor({
      log: () => ({
        info: (message) => entries.push({ level: "info", message }),
        debug: (message) => entries.push({ level: "debug", message }),
        error: (message) => entries.push({ level: "error", message }),
      }),
    });
    const executionContext = httpContext(method, "/health/readiness");

    await lastValueFrom(
      interceptor.intercept(executionContext, { handle: () => of("ok") }),
    );

    assert.deepEqual(entries.map(({ level, message }) => [level, message]), [
      ["debug", "Incoming request"],
      ["debug", "Request completed"],
    ]);
  }
});

test("only readiness uses debug; liveness and normal requests remain info", async () => {
  for (const url of ["/health/liveness", "/api/users"]) {
    const entries = [];
    const interceptor = new LoggingInterceptor({
      log: () => ({
        info: (message) => entries.push({ level: "info", message }),
        debug: (message) => entries.push({ level: "debug", message }),
        error: (message) => entries.push({ level: "error", message }),
      }),
    });

    await lastValueFrom(
      interceptor.intercept(httpContext("GET", url), { handle: () => of("ok") }),
    );

    assert.deepEqual(entries.map(({ level }) => level), ["info", "info"]);
  }
});

test("request failures remain error regardless of readiness path", async () => {
  const entries = [];
  const interceptor = new LoggingInterceptor({
    log: () => ({
      info: (message) => entries.push({ level: "info", message }),
      debug: (message) => entries.push({ level: "debug", message }),
      error: (message) => entries.push({ level: "error", message }),
    }),
  });

  await assert.rejects(
    lastValueFrom(
      interceptor.intercept(httpContext("GET", "/health/readiness"), {
        handle: () => throwError(() => new Error("probe failed")),
      }),
    ),
  );

  assert.deepEqual(entries.map(({ level, message }) => [level, message]), [
    ["debug", "Incoming request"],
    ["error", "Request failed"],
  ]);
});

test("HTTP logging fallback never reads x-forwarded-for directly", async () => {
  const entries = [];
  const interceptor = new LoggingInterceptor({
    log: () => ({
      info: (_message, metadata) => entries.push(metadata),
      debug: (_message, metadata) => entries.push(metadata),
      error: (_message, metadata) => entries.push(metadata),
    }),
  });
  const executionContext = {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({
        method: "GET",
        url: "/",
        ip: "10.0.0.8",
        headers: { "x-forwarded-for": "198.51.100.200" },
      }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  };

  await lastValueFrom(
    interceptor.intercept(executionContext, { handle: () => of("ok") }),
  );

  assert.equal(entries[0].ip, "10.0.0.8");
});

test("interceptor does not crash when ContextAccessor.get() returns undefined", async () => {
  const entries = [];
  const interceptor = new LoggingInterceptor({
    log: () => ({
      info: (message, metadata) => entries.push({ message, metadata }),
      debug: (message, metadata) => entries.push({ message, metadata }),
      error: (message, metadata) => entries.push({ message, metadata }),
    }),
  });
  const executionContext = {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({
        method: "GET",
        url: "/health",
        ip: "10.0.0.8",
        headers: { "user-agent": "direct-agent" },
      }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  };

  await lastValueFrom(
    interceptor.intercept(executionContext, { handle: () => of("ok") }),
  );

  assert.equal(entries[0].metadata.ip, "10.0.0.8");
  assert.equal(entries[0].metadata.userAgent, "direct-agent");
});

test("interceptor handles empty ContextAccessor client gracefully", async () => {
  const entries = [];
  const interceptor = new LoggingInterceptor({
    log: () => ({
      info: (message, metadata) => entries.push({ message, metadata }),
      debug: (message, metadata) => entries.push({ message, metadata }),
      error: (message, metadata) => entries.push({ message, metadata }),
    }),
  });
  const executionContext = {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({
        method: "GET",
        url: "/test",
        ip: "192.168.1.1",
        headers: {},
      }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  };

  await ContextAccessor.run(
    {
      requestId: "no-client-test",
      correlationId: "no-client-test",
      startedAtEpochMs: Date.now(),
      transport: { type: "http" },
    },
    () =>
      lastValueFrom(
        interceptor.intercept(executionContext, { handle: () => of("ok") }),
      ),
  );

  assert.equal(entries[0].metadata.ip, "192.168.1.1");
});

test("GraphQL operations are logged with canonical request metadata", async () => {
  const entries = [];
  const interceptor = new LoggingInterceptor({
    log: () => ({
      info: (message, metadata) => entries.push({ message, metadata }),
      debug: (message, metadata) => entries.push({ message, metadata }),
      error: (message, metadata) => entries.push({ message, metadata }),
    }),
  });
  const executionContext = {
    getType: () => "graphql",
    getArgByIndex: () => ({
      req: {
        url: "/graphql",
        body: { operationName: "CreateEvent" },
        headers: {},
      },
      reply: { statusCode: 200 },
    }),
  };

  await ContextAccessor.run(
    {
      requestId: "request-graphql",
      correlationId: "correlation-graphql",
      client: {},
      transport: { type: "graphql", operationName: "CreateEvent" },
    },
    () =>
      lastValueFrom(
        interceptor.intercept(executionContext, { handle: () => of("ok") }),
      ),
  );

  assert.equal(entries[0].metadata.method, "GRAPHQL");
  assert.equal(entries[0].metadata.url, "CreateEvent");
  assert.equal(entries[0].metadata.requestId, "request-graphql");
  assert.equal(entries[1].metadata.statusCode, 200);
});

function httpContext(method, url) {
  return {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({ method, url, ip: "127.0.0.1", headers: {} }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  };
}
