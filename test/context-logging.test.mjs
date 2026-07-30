import assert from "node:assert/strict";
import test from "node:test";
import { ContextAccessor } from "@omnixys/context-ts";
import { lastValueFrom, of } from "rxjs";
import { LoggingInterceptor } from "../dist/nest/logger.interceptor.js";

test("HTTP logging consumes canonical context instead of forwarded headers", async () => {
  const entries = [];
  const logger = {
    log: () => ({
      info: (message, metadata) => entries.push({ message, metadata }),
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

test("HTTP logging fallback never reads x-forwarded-for directly", async () => {
  const entries = [];
  const interceptor = new LoggingInterceptor({
    log: () => ({
      info: (_message, metadata) => entries.push(metadata),
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
