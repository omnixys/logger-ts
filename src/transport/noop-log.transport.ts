import type { LogDTO } from "@omnixys/contracts-ts";
import type { LogTransport } from "./log-transport.interface.js";

/** Default structured transport when Kafka forwarding is disabled. */
export class NoopLogTransport implements LogTransport {
  async send(_log: LogDTO): Promise<void> {}
  async flush(): Promise<void> {}
  async close(): Promise<void> {}
}
