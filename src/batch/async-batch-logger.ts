import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ContextStore } from "@omnixys/observability-ts";
import { type ContextLogDTO, type LogDTO } from "@omnixys/contracts-ts";
import { LOG_TRANSPORT, LOGGER_OPTIONS } from "../core/logger.constants.js";
import type { LoggerModuleOptions } from "../core/logger.options.js";
import type { LogTransport } from "../transport/log-transport.interface.js";
import { runWithTransportLoggingSuppressed } from "../transport/transport-recursion.guard.js";
import {
  attachLoggerBatch,
  detachLoggerBatch,
} from "../logger/logger-runtime.js";

export interface BatchLoggerDiagnostics {
  readonly initialized: boolean;
  readonly closing: boolean;
  readonly closed: boolean;
  readonly flushing: boolean;
  readonly buffered: number;
  readonly pending: number;
  readonly sent: number;
  readonly dropped: number;
  readonly transportFailures: number;
}

@Injectable()
export class AsyncBatchLogger implements OnModuleInit, OnModuleDestroy {
  private buffer: ContextLogDTO[] = [];
  private readonly pendingSends = new Set<Promise<void>>();
  private timer?: NodeJS.Timeout;
  private initialized = false;
  private closing = false;
  private closed = false;
  private activeFlush?: Promise<void>;
  private activeClose?: Promise<void>;
  private sent = 0;
  private dropped = 0;
  private transportFailures = 0;

  constructor(
    @Inject(LOGGER_OPTIONS)
    private readonly options: LoggerModuleOptions,
    @Inject(LOG_TRANSPORT)
    private readonly transport: LogTransport,
  ) {}

  onModuleInit(): void {
    attachLoggerBatch(this);
    if (this.initialized || !this.options.batch?.enabled) return;
    this.initialized = true;

    this.timer = setInterval(
      () => void this.flush(),
      positiveInteger(this.options.batch.flushInterval, 2_000),
    );
    this.timer.unref?.();
  }

  enqueue(log: LogDTO): void {
    if (this.closing || this.closed) {
      this.dropped += 1;
      return;
    }

    if (!this.options.batch?.enabled) {
      this.trackPendingSend(this.safeSend(log));
      return;
    }

    const maxBufferSize = positiveInteger(
      this.options.batch.maxBufferSize,
      Math.max(positiveInteger(this.options.batch.maxSize, 50) * 10, 1_000),
    );

    if (this.buffer.length >= maxBufferSize) {
      this.dropped += 1;
      if (this.options.batch.overflowStrategy === "drop-newest") return;
      this.buffer.shift();
    }

    this.buffer.push({ log, ctx: ContextStore.capture() });

    if (this.buffer.length >= positiveInteger(this.options.batch.maxSize, 50)) {
      void this.flush();
    }
  }

  flush(): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (this.activeFlush) return this.activeFlush;

    this.activeFlush = this.drain().finally(() => {
      this.activeFlush = undefined;
    });
    return this.activeFlush;
  }

  close(): Promise<void> {
    if (this.activeClose) return this.activeClose;
    if (this.closed) return Promise.resolve();

    this.closing = true;
    this.stopTimer();
    this.activeClose = (async () => {
      try {
        do {
          await this.flush();
        } while (this.buffer.length > 0 || this.pendingSends.size > 0);
        await this.safeTransportOperation(() => this.transport.close?.());
      } finally {
        this.closed = true;
      }
    })();

    return this.activeClose;
  }

  diagnostics(): BatchLoggerDiagnostics {
    return {
      initialized: this.initialized,
      closing: this.closing,
      closed: this.closed,
      flushing: this.activeFlush !== undefined,
      buffered: this.buffer.length,
      pending: this.pendingSends.size,
      sent: this.sent,
      dropped: this.dropped,
      transportFailures: this.transportFailures,
    };
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.close();
    } finally {
      detachLoggerBatch(this);
    }
  }

  private async drain(): Promise<void> {
    while (this.buffer.length > 0) {
      const batch = this.buffer.splice(0, this.buffer.length);
      for (const { log, ctx } of batch) {
        await ContextStore.run(ctx, () => this.safeSend(log));
      }
    }

    while (this.pendingSends.size > 0) {
      await Promise.all([...this.pendingSends]);
    }

    await this.safeTransportOperation(() => this.transport.flush?.());
  }

  private async safeSend(log: LogDTO): Promise<void> {
    const maxRetries = nonNegativeInteger(this.options.batch?.maxRetries, 0);

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        await runWithTransportLoggingSuppressed(() => this.transport.send(log));
        this.sent += 1;
        return;
      } catch {
        this.transportFailures += 1;
      }
    }

    this.dropped += 1;
  }

  private trackPendingSend(pending: Promise<void>): void {
    this.pendingSends.add(pending);
    void pending.finally(() => this.pendingSends.delete(pending));
  }

  private async safeTransportOperation(
    operation: () => Promise<void> | undefined,
  ): Promise<void> {
    try {
      await operation();
    } catch {
      this.transportFailures += 1;
    }
  }

  private stopTimer(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value !== undefined && value > 0
    ? value
    : fallback;
}

function nonNegativeInteger(
  value: number | undefined,
  fallback: number,
): number {
  return Number.isInteger(value) && value !== undefined && value >= 0
    ? value
    : fallback;
}
