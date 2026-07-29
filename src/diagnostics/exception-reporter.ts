import { Inject, Injectable } from "@nestjs/common";
import { ContextAccessor } from "@omnixys/context";
import { ErrorCode } from "@omnixys/contracts";
import { AsyncBatchLogger } from "../batch/async-batch-logger.js";
import { LOGGER_OPTIONS } from "../core/logger.constants.js";
import type { LoggerModuleOptions } from "../core/logger.options.js";
import { ScopedLogger } from "../logger/scoped-logger.js";
import { serializeExceptionForLog } from "./exception-serializer.js";

export interface ExceptionReportOptions {
  readonly operation?: string;
  readonly module?: string;
  readonly method?: string;
  readonly transport?: string;
  readonly httpMethod?: string;
  readonly route?: string;
  readonly statusCode?: number;
  readonly durationMs?: number;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

@Injectable()
export class ExceptionReporter {
  private readonly reported = new WeakSet<object>();
  private readonly logger: ScopedLogger;
  private readonly serviceName: string;

  constructor(
    @Inject(LOGGER_OPTIONS) options: LoggerModuleOptions,
    batch: AsyncBatchLogger,
  ) {
    this.serviceName = options.serviceName;
    this.logger = new ScopedLogger(
      "ExceptionReporter",
      options,
      batch,
      {},
      "request.error",
    );
  }

  report(error: unknown, options: ExceptionReportOptions = {}): boolean {
    if (error && typeof error === "object") {
      if (this.reported.has(error)) return false;
      this.reported.add(error);
    }

    const context = ContextAccessor.get();
    const exception = serializeExceptionForLog(
      error,
      internalCodeForService(this.serviceName),
    );
    this.logger.error("Operation failed", {
      code: exception.code,
      summary: exception.summary,
      httpStatus: exception.httpStatus,
      retryable: exception.retryable,
      operation:
        options.operation ?? context?.transport?.operation ?? "unknown",
      module: options.module,
      method: options.method,
      transport: options.transport ?? context?.transport?.type,
      httpMethod: options.httpMethod ?? context?.transport?.method,
      route: options.route ?? context?.transport?.route,
      statusCode: options.statusCode,
      durationMs: options.durationMs,
      diagnostics: options.diagnostics,
      exception,
    });
    return true;
  }
}

function internalCodeForService(serviceName: string): ErrorCode {
  const normalized = serviceName
    .replace(/^omnixys[-_]/, "")
    .replace(/[-_]service$/, "")
    .replace(/_/g, "-");
  const codes: Readonly<Record<string, ErrorCode>> = {
    analytics: ErrorCode.ANALYTICS_INTERNAL_ERROR,
    authentication: ErrorCode.AUTHENTICATION_INTERNAL_ERROR,
    blog: ErrorCode.BLOG_INTERNAL_ERROR,
    event: ErrorCode.EVENT_INTERNAL_ERROR,
    gateway: ErrorCode.GATEWAY_INTERNAL_ERROR,
    invitation: ErrorCode.INVITATION_INTERNAL_ERROR,
    notification: ErrorCode.NOTIFICATION_INTERNAL_ERROR,
    profile: ErrorCode.PROFILE_INTERNAL_ERROR,
    seat: ErrorCode.SEAT_INTERNAL_ERROR,
    "shopping-cart": ErrorCode.SHOPPING_CART_INTERNAL_ERROR,
    ticket: ErrorCode.TICKET_INTERNAL_ERROR,
    user: ErrorCode.USER_INTERNAL_ERROR,
  };
  return codes[normalized] ?? ErrorCode.INTERNAL_SERVER_ERROR;
}
