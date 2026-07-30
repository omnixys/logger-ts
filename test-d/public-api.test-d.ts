import {
  getLogger,
  LoggerModule,
  LoggingInterceptor,
  OmnixysLogger,
  ScopedLogger,
} from "@omnixys/logger-ts";

const dynamicModule = LoggerModule.forRoot({ serviceName: "orders" });
const pinoLogger = getLogger("OrdersService");

declare const logger: OmnixysLogger;
const scoped: ScopedLogger = logger.log("OrdersService");

scoped.info("created order");
scoped.error("failed order", new Error("failure"));
scoped.warn("slow order", { duration: 100 });
scoped.debug("orderId=%s", "order-1");
scoped.trace("trace order");
const child: ScopedLogger = scoped.child("repository", { database: "orders" });
const metadataChild: ScopedLogger = scoped.withMetadata({ region: "eu" });
const factoryChild: ScopedLogger = logger.child("OrdersService", {
  component: "repository",
});
const loggerFlush: Promise<void> = logger.flush();
const loggerClose: Promise<void> = logger.close();
const scopedFlush: Promise<void> = scoped.flush();
const scopedClose: Promise<void> = scoped.close();
const diagnostics: { closed: boolean; hooksInstalled: boolean } =
  logger.diagnostics();

const interceptor = new LoggingInterceptor(logger);

void dynamicModule;
void pinoLogger;
void interceptor;
void child;
void metadataChild;
void factoryChild;
void loggerFlush;
void loggerClose;
void scopedFlush;
void scopedClose;
void diagnostics;
