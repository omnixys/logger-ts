export const OMNIXYS_LOGGER = Symbol.for('@omnixys/logger-ts');

export type PlatformLogMetadata = Readonly<Record<string, unknown>>;

export interface PlatformScopedLogger {
  trace(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface PlatformLogger {
  child(context: string, metadata?: PlatformLogMetadata): PlatformScopedLogger;
  log(context: string): PlatformScopedLogger;
}
