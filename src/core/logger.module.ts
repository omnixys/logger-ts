import { type DynamicModule, Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AsyncBatchLogger } from "../batch/async-batch-logger.js";
import { OmnixysLogger } from "../logger/omnixys-logger.js";
import { OtelLogTransport } from "../transport/otel-log.transport.js";
import { installLoggerShutdownHooks } from "../logger/logger.config.js";
import { LOG_TRANSPORT, LOGGER_OPTIONS } from "./logger.constants.js";
import type { LoggerModuleOptions } from "./logger.options.js";
import { OMNIXYS_LOGGER } from "../token.js";
import { LoggingInterceptor } from "../nest/logger.interceptor.js";
import { ExceptionReporter } from "../diagnostics/exception-reporter.js";
import { configureLoggerRuntime } from "../logger/logger-runtime.js";

@Global()
@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions): DynamicModule {
    configureLoggerRuntime(options);
    installLoggerShutdownHooks();

    return {
      module: LoggerModule,
      providers: [
        { provide: LOGGER_OPTIONS, useValue: options },

        AsyncBatchLogger,
        OmnixysLogger,
        ExceptionReporter,
        LoggingInterceptor,
        { provide: OMNIXYS_LOGGER, useExisting: OmnixysLogger },

        ...(options.registerGlobalInterceptor
          ? [{ provide: APP_INTERCEPTOR, useExisting: LoggingInterceptor }]
          : []),

        { provide: LOG_TRANSPORT, useClass: OtelLogTransport },
      ],
      exports: [
        OmnixysLogger,
        OMNIXYS_LOGGER,
        ExceptionReporter,
        LoggingInterceptor,
      ],
    };
  }
}
