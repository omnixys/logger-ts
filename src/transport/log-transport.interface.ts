import { LogDTO } from "@omnixys/contracts-ts";

export interface LogTransport {
  send(log: LogDTO): Promise<void>;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}
