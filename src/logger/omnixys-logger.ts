import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { AsyncBatchLogger } from "../batch/async-batch-logger.js";
import { LOGGER_OPTIONS } from "../core/logger.constants.js";
import type { LoggerModuleOptions } from "../core/logger.options.js";
import { type LoggerMetadata, ScopedLogger } from "./scoped-logger.js";
import {
  closeParentLogger,
  flushParentLogger,
  loggerRuntimeDiagnostics,
} from "./logger.config.js";
import { loggerRuntimeSinkDiagnostics } from "./logger-runtime.js";

@Injectable()
export class OmnixysLogger implements OnModuleDestroy {
  constructor(
    @Inject(LOGGER_OPTIONS)
    private readonly options: LoggerModuleOptions,
    private readonly batch: AsyncBatchLogger,
  ) {}

  log(context: string): ScopedLogger {
    return new ScopedLogger(context, this.options, this.batch);
  }

  child(context: string, metadata: LoggerMetadata = {}): ScopedLogger {
    return new ScopedLogger(context, this.options, this.batch, metadata);
  }

  async flush(): Promise<void> {
    await this.batch.flush();
    await flushParentLogger();
  }

  async close(): Promise<void> {
    await this.batch.close();
    await closeParentLogger();
  }

  diagnostics() {
    return {
      ...loggerRuntimeDiagnostics(),
      ...loggerRuntimeSinkDiagnostics(),
      ...this.batch.diagnostics(),
    };
  }

  onModuleDestroy(): Promise<void> {
    return this.close();
  }
}
