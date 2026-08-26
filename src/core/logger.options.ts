export interface LoggerModuleOptions {
  serviceName: string;

  /** Runtime environment used to select safe sink defaults. */
  environment?: string;

  /** stdout/stderr logging. LOG_CONSOLE_LEVEL and LOG_PRETTY take precedence. */
  console?: {
    enabled?: boolean;
    level?: LoggerSinkLevel;
    pretty?: boolean;
  };

  /** OpenTelemetry logging. LOG_OTEL_LEVEL takes precedence. */
  otel?: {
    enabled?: boolean;
    level?: LoggerSinkLevel;
  };

  /** Register request logging globally for HTTP and GraphQL operations. */
  registerGlobalInterceptor?: boolean;

  batch?: {
    enabled?: boolean;
    maxSize?: number;
    maxBufferSize?: number;
    flushInterval?: number;
    maxRetries?: number;
    overflowStrategy?: "drop-oldest" | "drop-newest";
  };
}

export type LoggerSinkLevel =
  "silent" | "trace" | "debug" | "info" | "warn" | "error";
