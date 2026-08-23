import { resolve } from "node:path";
import pino, { type TransportTargetOptions } from "pino";

const {
  NODE_ENV,
  LOG_DIRECTORY,
  LOG_FILE_DEFAULT_NAME,
  LOG_PRETTY,
  LOG_LEVEL,
  LOG_TO_FILE,
  SERVICE_NAME,
} = process.env;

const logFile = resolve(LOG_DIRECTORY ?? "log", LOG_FILE_DEFAULT_NAME ?? "server.log");
const isProd = NODE_ENV === "production";
const logToFile = LOG_TO_FILE === "true";

const logLevel = (LOG_LEVEL ?? (isProd ? "info" : "debug")) as
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace";

const pretty = !isProd && (LOG_PRETTY === undefined || LOG_PRETTY === "true");

const fileTarget: TransportTargetOptions = {
  level: logLevel,
  target: "pino/file",
  options: {
    destination: logFile,
    mkdir: true,
  },
};

const prettyTarget: TransportTargetOptions = {
  level: logLevel,
  target: "pino-pretty",
  options: {
    translateTime: "SYS:standard",
    singleLine: true,
    colorize: true,
    ignore: "pid,hostname,req,res",
  },
};

const targets: TransportTargetOptions[] = [];
if (logToFile) targets.push(fileTarget);
if (pretty) targets.push(prettyTarget);

const useTransport = targets.length > 0;
const transport = useTransport ? pino.transport({ targets }) : undefined;

if (transport) {
  transport.on("error", (err: Error) => {
    try {
      process.stderr.write(`[omnixys/logger] transport failure: ${err.message}\n`);
    } catch {
      // best-effort fallback
    }
  });
}

export const parentLogger = pino(
  {
    level: logLevel,
    base: {
      env: NODE_ENV,
      service: SERVICE_NAME ?? process.env.SERVICE ?? "unknown",
    },
  },
  ...(transport ? [transport] : []),
);

let hooksInstalled = false;
let runtimeClosed = false;
let activeFlush: Promise<void> | undefined;
let activeClose: Promise<void> | undefined;

const beforeExitHandler = () => {
  void flushParentLogger();
};
const sigintHandler = () => {
  shutdownAndResignal("SIGINT");
};
const sigtermHandler = () => {
  shutdownAndResignal("SIGTERM");
};

export function flushParentLogger(): Promise<void> {
  if (runtimeClosed) return Promise.resolve();
  if (activeFlush) return activeFlush;

  const flushing = new Promise<void>((resolveFlush) => {
    try {
      parentLogger.flush(() => resolveFlush());
    } catch {
      resolveFlush();
    }
  }).finally(() => {
    activeFlush = undefined;
  });
  activeFlush = flushing;
  return flushing;
}

export function closeParentLogger(): Promise<void> {
  if (activeClose) return activeClose;
  if (runtimeClosed) return Promise.resolve();

  activeClose = (async () => {
    await flushParentLogger();

    if (transport) {
      try {
        transport.flushSync();
      } catch {
        // Logging shutdown must never fail application shutdown.
      }

      try {
        transport.end();
      } catch {
        // A previously closed worker is already in the desired state.
      }
    }

    runtimeClosed = true;
    removeLoggerShutdownHooks();
  })();

  return activeClose;
}

export function installLoggerShutdownHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;
  process.once("beforeExit", beforeExitHandler);
  process.once("SIGINT", sigintHandler);
  process.once("SIGTERM", sigtermHandler);
}

export function removeLoggerShutdownHooks(): void {
  if (!hooksInstalled) return;
  hooksInstalled = false;
  process.removeListener("beforeExit", beforeExitHandler);
  process.removeListener("SIGINT", sigintHandler);
  process.removeListener("SIGTERM", sigtermHandler);
}

export function isParentLoggerClosed(): boolean {
  return runtimeClosed;
}

export function loggerRuntimeDiagnostics() {
  return {
    closed: runtimeClosed,
    hooksInstalled,
  };
}

function shutdownAndResignal(signal: "SIGINT" | "SIGTERM"): void {
  void closeParentLogger().finally(() => {
    try {
      process.kill(process.pid, signal);
    } catch {
      process.exitCode = signal === "SIGINT" ? 130 : 143;
    }
  });
}
