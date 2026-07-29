import assert from "node:assert/strict";
import test from "node:test";
import { FrameworkException } from "@omnixys/contracts";
import {
  ExceptionReporter,
  redactForLog,
  serializeExceptionForLog,
} from "../dist/index.js";

test("recursive log redaction removes secrets before transport", () => {
  const redacted = redactForLog({
    authorization: "Bearer secret",
    nested: {
      password: "secret",
      safe: "visible",
      message: "authorization=Bearer abc.def password=hunter2",
      headers: { cookie: "session=secret" },
    },
  });

  assert.deepEqual(redacted, {
    authorization: "[REDACTED]",
    nested: {
      password: "[REDACTED]",
      safe: "visible",
      message: "authorization=[REDACTED] password=[REDACTED]",
      headers: { cookie: "[REDACTED]" },
    },
  });
});

test("exception serialization retains a sanitized cause chain", () => {
  const root = Object.assign(new Error("Keycloak request failed"), {
    response: {
      status: 401,
      data: { error: "invalid_client", client_secret: "must-not-leak" },
    },
  });
  const error = new FrameworkException(
    "IDENTITY_PROVIDER_CLIENT_CONFIGURATION_INVALID",
    "Authentication is temporarily unavailable.",
    {
      cause: root,
      diagnostics: {
        provider: "keycloak",
        clientSecret: "must-not-leak",
      },
    },
  );
  const serialized = serializeExceptionForLog(error);
  const json = JSON.stringify(serialized);

  assert.equal(serialized.httpStatus, 500);
  assert.equal(serialized.code, "IDENTITY_PROVIDER_CLIENT_CONFIGURATION_INVALID");
  assert.equal(json.includes("must-not-leak"), false);
  assert.equal(json.includes("[REDACTED]"), true);
  assert.equal(serialized.cause.message, "Keycloak request failed");
});

test("exception reporter emits one canonical event per exception object", () => {
  const records = [];
  const reporter = new ExceptionReporter(
    { serviceName: "authentication" },
    { enqueue: (record) => records.push(record) },
  );
  const error = new Error("failure");

  assert.equal(reporter.report(error, { operation: "login" }), true);
  assert.equal(reporter.report(error, { operation: "login" }), false);
  assert.equal(records.length, 1);
  assert.equal(records[0].metadata.operation, "login");
  assert.equal(records[0].metadata.code, "AUTHENTICATION_INTERNAL_ERROR");
});

test("dependency serializers keep only safe Axios and Prisma fields", () => {
  const axios = Object.assign(new Error("request failed"), {
    name: "AxiosError",
    isAxiosError: true,
    code: "ECONNRESET",
    config: {
      method: "post",
      url: "https://identity.example.test/realms/main/token",
      headers: { authorization: "Bearer must-not-leak" },
      data: { client_secret: "must-not-leak" },
    },
    response: {
      status: 401,
      data: { error: "invalid_client", access_token: "must-not-leak" },
    },
  });
  const prisma = Object.assign(new Error("constraint failed"), {
    name: "PrismaClientKnownRequestError",
    code: "P2002",
    meta: {
      modelName: "User",
      operation: "create",
      target: ["email"],
      query: "select secret",
    },
  });

  const axiosSerialized = serializeExceptionForLog(axios);
  const prismaSerialized = serializeExceptionForLog(prisma);

  assert.deepEqual(axiosSerialized.dependency, {
    system: "http",
    code: "ECONNRESET",
    upstreamStatus: 401,
    method: "POST",
    host: "identity.example.test",
    path: "/realms/main/token",
    oauthError: "invalid_client",
  });
  assert.deepEqual(prismaSerialized.dependency, {
    system: "prisma",
    code: "P2002",
    model: "User",
    operation: "create",
    constraint: ["email"],
  });
  assert.equal(JSON.stringify(axiosSerialized).includes("must-not-leak"), false);
  assert.equal(JSON.stringify(prismaSerialized).includes("select secret"), false);
});
