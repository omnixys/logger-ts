# @omnixys/logger-ts

Structured NestJS/Pino logging with a shared OpenTelemetry log path.

## Sink levels

Console and OTLP levels are independent:

| Environment                     | Console default | OTLP default |
| ------------------------------- | --------------- | ------------ |
| `dev`, `development`, `local`   | `trace`         | `trace`      |
| `staging`, `prod`, `production` | `info`          | `trace`      |
| `test`                          | `silent`        | `silent`     |

`LOG_CONSOLE_LEVEL` overrides the console threshold and `LOG_OTEL_LEVEL`
overrides the OTLP threshold. `LOG_LEVEL` remains a console-only compatibility
fallback. `LOG_PRETTY` changes only console rendering.

Both `OmnixysLogger` and the legacy Pino-compatible `getLogger()` entry point
use the same OTLP path. Prefer `OmnixysLogger` through Nest dependency injection
for application code.
