import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Optional,
  type NestInterceptor,
} from "@nestjs/common";
import { ContextAccessor } from "@omnixys/context-ts/accessor";

import { type Observable, tap } from "rxjs";
import { OmnixysLogger } from "../logger/omnixys-logger.js";
import { getCanonicalLogMetadata } from "../logger/context-log-metadata.js";
import { ExceptionReporter } from "../diagnostics/exception-reporter.js";
import { serializeExceptionForLog } from "../diagnostics/exception-serializer.js";

type HttpRequest = {
  method?: string;
  url?: string;
  originalUrl?: string;
  headers?: Record<string, any>;
  ip?: string;
  user?: { id?: string };
  body?: { operationName?: string };
};

type HttpResponse = {
  statusCode?: number;
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(logger: OmnixysLogger);
  constructor(
    logger: OmnixysLogger,
    exceptionReporter?: ExceptionReporter,
  );
  constructor(
    private readonly logger: OmnixysLogger,
    @Optional() private readonly exceptionReporter?: ExceptionReporter,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const transport = requestTransport(context);
    if (!transport) {
      return next.handle();
    }

    const { request, response, type } = transport;

    const method = type === "graphql" ? "GRAPHQL" : request.method ?? "UNKNOWN";

    const url =
      request.body?.operationName ??
      request.originalUrl ??
      request.url ??
      "UNKNOWN";

    const requestContext = ContextAccessor.get();
    const userAgent =
      requestContext?.client?.userAgent ?? request?.headers?.["user-agent"];
    const ip = requestContext?.client?.ip ?? request?.ip;
    const userId =
      requestContext?.principal?.userId ??
      requestContext?.principal?.actorId ??
      request?.user?.id;

    const log = this.logger.log("http.request");
    const requestLog = isReadinessRequest(url) ? log.debug : log.info;

    const start = Date.now();

    requestLog.call(log, "Incoming request", {
      method,
      url,
      ip,
      userAgent,
      userId,
      ...getCanonicalLogMetadata(),
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;

          requestLog.call(log, "Request completed", {
            method,
            url,
            statusCode: response.statusCode,
            duration,
            ip,
            userId,
            ...getCanonicalLogMetadata(),
          });
        },
        error: (err: unknown) => {
          const duration = Date.now() - start;
          if (this.exceptionReporter) {
            this.exceptionReporter.report(err, {
              operation: requestContext?.transport?.operation ?? url,
              module: context.getClass?.()?.name,
              method: context.getHandler?.()?.name,
              transport: type,
              httpMethod: method,
              route: url,
              statusCode: response.statusCode,
              durationMs: duration,
            });
          } else {
            log.error("Request failed", {
              method,
              url,
              statusCode: response.statusCode,
              duration,
              ip,
              userId,
              ...getCanonicalLogMetadata(),
              exception: serializeExceptionForLog(err),
            });
          }
        },
      }),
    );
  }
}

function isReadinessRequest(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  return path === "/health/readiness";
}

function requestTransport(
  context: ExecutionContext,
):
  | { request: HttpRequest; response: HttpResponse; type: "http" | "graphql" }
  | undefined {
  const type = context.getType<string>();

  if (type === "http") {
    const http = context.switchToHttp();
    return {
      request: http.getRequest<HttpRequest>(),
      response: http.getResponse<HttpResponse>(),
      type,
    };
  }

  if (type === "graphql") {
    const gqlContext = context.getArgByIndex<{
      req?: HttpRequest;
      request?: HttpRequest;
      reply?: HttpResponse;
      res?: HttpResponse;
    }>(2);
    const request = gqlContext?.req ?? gqlContext?.request;
    if (!request) return undefined;

    return {
      request,
      response: gqlContext.reply ?? gqlContext.res ?? {},
      type,
    };
  }

  return undefined;
}
