# 🧾 Changelog

All notable changes in this project will be documented in this file.


## [3.1.0](https://github.com/omnixys/logger/compare/v3.0.0...v3.1.0) (2026-07-23)

### Logger

* **Logger:** bridge canonical logs to OpenTelemetry ([](https://github.com/omnixys/logger/commit/6e5d8cd7c42cc8cce6181dc8d220a895a0a166f6))
* **Logger:** populate traceContext on LogDTO from active OTel context ([](https://github.com/omnixys/logger/commit/aafe250d14dd90731e7c928e63a3e455f4ea5d07))
* **Logger:** remove Kafka log transport ([](https://github.com/omnixys/logger/commit/75ff6984989ec0bc23573a9929c4743d6a9be659))

## [3.0.0](https://github.com/omnixys/logger/compare/v2.0.1...v3.0.0) (2026-07-15)

### Update

* **Update:** update package ([](https://github.com/omnixys/logger/commit/3740ff64a643f179c41075d7dc5884a319a0df41))

## [2.0.1](https://github.com/omnixys/logger/compare/v2.0.0...v2.0.1) (2026-06-24)

### Context

* **Context:** Update async-batch-logger.ts ([](https://github.com/omnixys/logger/commit/63fce0d2c82c3ca752855edad44d89a94e205c76))

## [2.0.0](https://github.com/omnixys/logger/compare/v1.0.0...v2.0.0) (2026-06-23)

### Logger

* **Logger:** make file logging opt-in ([](https://github.com/omnixys/logger/commit/da563a55280a75560b11447aa910da243177723b))
* **Logger:** add global GraphQL request logging ([](https://github.com/omnixys/logger/commit/dce574d92e20364479729b401ea979f3278c17fb))
* **Logger:** complete P0 logger hardening and context integration ([](https://github.com/omnixys/logger/commit/78fc76dcc8380c9612f96bdf4790bf31f52b69f3))
* **Logger:** expose lightweight logger token ([](https://github.com/omnixys/logger/commit/08bc804ef832d8b6ebb946b9385d26744b6be385))
* **Logger:** use lightweight context accessor ([](https://github.com/omnixys/logger/commit/4688da4b2b69e572db62f281b9157b4c7b853a68))
* **Logger:** consume canonical log contracts ([](https://github.com/omnixys/logger/commit/a7539ba5bf0b01583a73fef0172d1bc195ffa3ef))

## 1.0.0 (2026-04-15)

### ⚠ BREAKING CHANGE

* **Logger:** Complete redesign of logging system with structured logging, context awareness,
and tight integration with @omnixys/context-ts and @omnixys/observability-ts.
Legacy logging utilities and unstructured log patterns have been removed.

✨ Features:
- Structured logging (JSON-first) for production-grade observability
- Context-aware logging:
  - Automatic injection of requestId, tenantId, actorId
  - Integration with AsyncLocalStorage via @omnixys/context-ts
- Trace correlation:
  - Automatic linking of logs to OpenTelemetry traces/spans
  - traceId and spanId enrichment
- OmnixysLogger abstraction:
  - log(), info(), warn(), error(), debug()
  - Scoped loggers per service/class/module
- Child logger support with contextual metadata
- Built-in log formatting and normalization
- Error logging with stack trace and structured metadata
- Environment-aware configuration (dev vs prod logging behavior)

⚙️ Improvements:
- Strongly typed logging APIs
- Eliminated console.log and inconsistent logging patterns
- Standardized log structure across all services
- Improved debuggability in distributed systems
- Reduced noise through consistent log levels and formatting

🧱 Architecture:
- Lightweight abstraction over structured logging engine (e.g. pino-compatible)
- Tight integration with:
  - @omnixys/context-ts (request-scoped metadata)
  - @omnixys/observability-ts (trace correlation)
- Scoped logger instances for modular logging
- Designed for high-throughput microservices

🛑 Removed / Changed:
- Removed unstructured logging and ad-hoc logger usage
- Replaced manual metadata injection with automatic context binding
- Deprecated inconsistent log formats and message patterns

📦 Compatibility:
- Requires Node.js >= 20
- Designed for NestJS-based microservices
- Fully compatible with:
  - @omnixys/context-ts (request context propagation)
  - @omnixys/observability-ts (tracing integration)
  - @omnixys/kafka (event-level logging)
  - @omnixys/security (audit & security logs)

📚 Notes:
This release establishes a unified, structured logging foundation across all
Omnixys services, enabling traceable, searchable, and context-rich logs for
modern distributed architectures.
* **Logger:** Complete redesign of logging system with structured logging, context awareness,
and tight integration with @omnixys/context-ts and @omnixys/observability-ts.
Legacy logging utilities and unstructured log patterns have been removed.

✨ Features:
- Structured logging (JSON-first) for production-grade observability
- Context-aware logging:
  - Automatic injection of requestId, tenantId, actorId
  - Integration with AsyncLocalStorage via @omnixys/context-ts
- Trace correlation:
  - Automatic linking of logs to OpenTelemetry traces/spans
  - traceId and spanId enrichment
- OmnixysLogger abstraction:
  - log(), info(), warn(), error(), debug()
  - Scoped loggers per service/class/module
- Child logger support with contextual metadata
- Built-in log formatting and normalization
- Error logging with stack trace and structured metadata
- Environment-aware configuration (dev vs prod logging behavior)

⚙️ Improvements:
- Strongly typed logging APIs
- Eliminated console.log and inconsistent logging patterns
- Standardized log structure across all services
- Improved debuggability in distributed systems
- Reduced noise through consistent log levels and formatting

🧱 Architecture:
- Lightweight abstraction over structured logging engine (e.g. pino-compatible)
- Tight integration with:
  - @omnixys/context-ts (request-scoped metadata)
  - @omnixys/observability-ts (trace correlation)
- Scoped logger instances for modular logging
- Designed for high-throughput microservices

🛑 Removed / Changed:
- Removed unstructured logging and ad-hoc logger usage
- Replaced manual metadata injection with automatic context binding
- Deprecated inconsistent log formats and message patterns

📦 Compatibility:
- Requires Node.js >= 20
- Designed for NestJS-based microservices
- Fully compatible with:
  - @omnixys/context-ts (request context propagation)
  - @omnixys/observability-ts (tracing integration)
  - @omnixys/kafka (event-level logging)
  - @omnixys/security (audit & security logs)

📚 Notes:
This release establishes a unified, structured logging foundation across all
Omnixys services, enabling traceable, searchable, and context-rich logs for
modern distributed architectures.
* **Logger:** * complete introduction of new @omnixys/logger-ts package
* replaces all previous ad-hoc logging implementations
* introduces structured, context-aware logging system
* logging API is now scoped-based via OmnixysLogger.createScope()

### Kafka

* **Kafka:** update transport ([](https://github.com/omnixys/logger/commit/141e3bf14fbadad7ad508bc1cd45a28da5ccf5ee))

### Logger

* **Logger:** introduce enterprise-grade structured logger with async batching and transport abstraction ([](https://github.com/omnixys/logger/commit/16294d12b408b3c50f674aab75ee884b95785177))
* **Logger:** structured logging, context-aware logs & trace correlation ([](https://github.com/omnixys/logger/commit/0aefdd0117732c42e1e87a53f1c66f8417b46530))
* **Logger:** structured logging, context-aware logs & trace correlation ([](https://github.com/omnixys/logger/commit/3e30fa277a115e3187798850262832e95ebe469a))
* **Logger:** v1.0.0 ([](https://github.com/omnixys/logger/commit/df78b4cbaa8efa133647441aac40f46e4d76a7e0))
* **Logger:** update logger ([](https://github.com/omnixys/logger/commit/fab6c8e29ef832bb6c11aef095849e39297a3676))
* **Logger:** add Scoped Logger ([](https://github.com/omnixys/logger/commit/2244499de6f0c16c406d9c243c57f59aa18a808c))
* **Logger:** resolve NestJS DI failure caused by type-only import ([](https://github.com/omnixys/logger/commit/8652a81aae6c6df074326fd0293c581ac950fa8b))
* **Logger:** resolve type safety issues in scoped logger and stabilize DTS build ([](https://github.com/omnixys/logger/commit/d837bcb5959c72eb32577cdb7f57bb117d05588f))

### Other

* **Other:** breaking(logger: )Propagate context and normalize log payloads ([](https://github.com/omnixys/logger/commit/05267fb67cec4cfcb115ded3e0dbd47e3e0ca8ed))
* **Other:** Initial commit ([](https://github.com/omnixys/logger/commit/1b2c098d34e921eb970bace676ddc3dbdfbc5ee2))
* **Other:** Merge branch 'main' of https://github.com/omnixys/logger ([](https://github.com/omnixys/logger/commit/167c5f17e3184796bce5f71eecb2506a00207abc))
* **Other:** Merge branch 'main' of https://github.com/omnixys/logger ([](https://github.com/omnixys/logger/commit/9c11c882b796f64bfd948e2a0444cd9bc45da2ff))

### Release

* **Release:** 1.0.0 [skip ci] ([](https://github.com/omnixys/logger/commit/01a082f469bd29fd8924a9cb37898851e3271fb8))
* **Release:** 1.0.0 [skip ci] ([](https://github.com/omnixys/logger/commit/7835d4b7612016c560d105e935a0d8936d29eebe))
* **Release:** 1.0.1 [skip ci] ([](https://github.com/omnixys/logger/commit/620d8a5e56362f6ebbda9a18518842d4db8a0aaa))
* **Release:** 1.1.0 [skip ci] ([](https://github.com/omnixys/logger/commit/0d48a3ab9951bc05616130002ce12b2466691734))
* **Release:** 1.2.0 [skip ci] ([](https://github.com/omnixys/logger/commit/af1980d7690a6cde3875d36723755eb8ccc092de))
* **Release:** 1.2.1 [skip ci] ([](https://github.com/omnixys/logger/commit/acbe02ba01b8d9094b4703f4d46a279b330c9143))
* **Release:** 1.2.2 [skip ci] ([](https://github.com/omnixys/logger/commit/e77764636186b93aba3d8bb6737afb66f9e4f214))

## [1.2.2](https://github.com/omnixys/logger/compare/v1.2.1...v1.2.2) (2026-03-24)

### Logger

* **Logger:** resolve NestJS DI failure caused by type-only import ([](https://github.com/omnixys/logger/commit/8652a81aae6c6df074326fd0293c581ac950fa8b))

## [1.2.1](https://github.com/omnixys/logger/compare/v1.2.0...v1.2.1) (2026-03-24)

### Logger

* **Logger:** add Scoped Logger ([](https://github.com/omnixys/logger/commit/2244499de6f0c16c406d9c243c57f59aa18a808c))

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/logger ([](https://github.com/omnixys/logger/commit/167c5f17e3184796bce5f71eecb2506a00207abc))

## [1.2.0](https://github.com/omnixys/logger/compare/v1.1.0...v1.2.0) (2026-03-24)

### Kafka

* **Kafka:** update transport ([](https://github.com/omnixys/logger/commit/141e3bf14fbadad7ad508bc1cd45a28da5ccf5ee))

## [1.1.0](https://github.com/omnixys/logger/compare/v1.0.1...v1.1.0) (2026-03-24)

### Logger

* **Logger:** update logger ([](https://github.com/omnixys/logger/commit/fab6c8e29ef832bb6c11aef095849e39297a3676))

## [1.0.1](https://github.com/omnixys/logger/compare/v1.0.0...v1.0.1) (2026-03-24)

### Logger

* **Logger:** resolve type safety issues in scoped logger and stabilize DTS build ([](https://github.com/omnixys/logger/commit/d837bcb5959c72eb32577cdb7f57bb117d05588f))

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/logger ([](https://github.com/omnixys/logger/commit/9c11c882b796f64bfd948e2a0444cd9bc45da2ff))

## 1.0.0 (2026-03-23)

### ⚠ BREAKING CHANGE

* **Logger:** * complete introduction of new @omnixys/logger-ts package
* replaces all previous ad-hoc logging implementations
* introduces structured, context-aware logging system
* logging API is now scoped-based via OmnixysLogger.createScope()

### Logger

* **Logger:** introduce enterprise-grade structured logger with async batching and transport abstraction ([](https://github.com/omnixys/logger/commit/16294d12b408b3c50f674aab75ee884b95785177))
* **Logger:** v1.0.0 ([](https://github.com/omnixys/logger/commit/df78b4cbaa8efa133647441aac40f46e4d76a7e0))

### Other

* **Other:** Initial commit ([](https://github.com/omnixys/logger/commit/1b2c098d34e921eb970bace676ddc3dbdfbc5ee2))

### Release

* **Release:** 1.0.0 [skip ci] ([](https://github.com/omnixys/logger/commit/7835d4b7612016c560d105e935a0d8936d29eebe))

## 1.0.0 (2026-03-23)

### ⚠ BREAKING CHANGE

* **Logger:** * complete introduction of new @omnixys/logger-ts package
* replaces all previous ad-hoc logging implementations
* introduces structured, context-aware logging system
* logging API is now scoped-based via OmnixysLogger.createScope()

### Logger

* **Logger:** introduce enterprise-grade structured logger with async batching and transport abstraction ([](https://github.com/omnixys/logger/commit/16294d12b408b3c50f674aab75ee884b95785177))

### Other

* **Other:** Initial commit ([](https://github.com/omnixys/logger/commit/1b2c098d34e921eb970bace676ddc3dbdfbc5ee2))

## [1.6.6](https://github.com/omnixys/observability/compare/v1.6.5...v1.6.6) (2026-03-18)

### U

* **U:** u ([](https://github.com/omnixys/observability/commit/92f661911afe0fbfe74a9ea6cecfd0989afcfa38))

## [1.6.5](https://github.com/omnixys/observability/compare/v1.6.4...v1.6.5) (2026-03-18)

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/observability ([](https://github.com/omnixys/observability/commit/268e7f4319219358c6750fe9c7a8724eda2c38c3))

### U

* **U:** Update batch-logger.ts ([](https://github.com/omnixys/observability/commit/a095ac7221426e4995a87ce1e79e32818cf7a6e0))

## [1.6.4](https://github.com/omnixys/observability/compare/v1.6.3...v1.6.4) (2026-03-18)

### J

* **J:** u ([](https://github.com/omnixys/observability/commit/2ebc064d2464009660c872d83b80749d43f371c4))

## [1.6.3](https://github.com/omnixys/observability/compare/v1.6.2...v1.6.3) (2026-03-18)

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/observability ([](https://github.com/omnixys/observability/commit/dd23c1a9e7493042abeeef69cb6feccb0424a890))

### U

* **U:** u ([](https://github.com/omnixys/observability/commit/8f060db918bb43897957ea4a2e1cadbff01101c7))

## [1.6.2](https://github.com/omnixys/observability/compare/v1.6.1...v1.6.2) (2026-03-18)

### U

* **U:** update ([](https://github.com/omnixys/observability/commit/18afda8e159e30e6925dcda00f581811abbf5082))

## [1.6.1](https://github.com/omnixys/observability/compare/v1.6.0...v1.6.1) (2026-03-18)

### Update

* **Update:** update ([](https://github.com/omnixys/observability/commit/2b01661ab03a3df518756999a2519e7fd3479a3a))

## [1.6.0](https://github.com/omnixys/observability/compare/v1.5.1...v1.6.0) (2026-03-18)

### Observability

* **Observability:** implement distributed tracing across Kafka with OpenTelemetry ([](https://github.com/omnixys/observability/commit/7a378d5312b0a48e80afac99fda29e8d72cfebbb))

### Tracing

* **Tracing:** Einführung von echtem Distributed Tracing (OpenTelemetry + Kafka) ([](https://github.com/omnixys/observability/commit/8cb60ccaa0abe4f5b28e8e760e4802143f05fb59))

## [1.5.1](https://github.com/omnixys/observability/compare/v1.5.0...v1.5.1) (2026-03-18)

### Observability

* **Observability:** correct printf handling and restore structured metadata logging ([](https://github.com/omnixys/observability/commit/93efe96f93d46ef129698612996bc3238424eef1))

## [1.5.0](https://github.com/omnixys/observability/compare/v1.4.5...v1.5.0) (2026-03-18)

### Logger

* **Logger:** add smart structured extraction ([](https://github.com/omnixys/observability/commit/9786643471f89cf56692d78382128729c9dc282e))
* **Logger:** fix Logger ([](https://github.com/omnixys/observability/commit/ab06ba5c23888454be021ae97fdd4f2a4501f1e0))

### Observability

* **Observability:** introduce hybrid logger (printf + structured logging) ([](https://github.com/omnixys/observability/commit/817376ab45d4ad922f6b7f5feed9fb1fb7ba03a5))

## [1.4.5](https://github.com/omnixys/observability/compare/v1.4.4...v1.4.5) (2026-03-18)

### Logger

* **Logger:** update logger ([](https://github.com/omnixys/observability/commit/b91ec1060cba6b82cf2e42bdbd4e3c42627afa49))

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/observability ([](https://github.com/omnixys/observability/commit/f73a472c44bae73f34c01aa365b041d7e258b5b6))

## [1.4.4](https://github.com/omnixys/observability/compare/v1.4.3...v1.4.4) (2026-03-18)

### Logger

* **Logger:** update logger ([](https://github.com/omnixys/observability/commit/caaa819ddbe83550b9d5b432456f5c3048fac53e))

## [1.4.3](https://github.com/omnixys/observability/compare/v1.4.2...v1.4.3) (2026-03-18)

### Logger

* **Logger:** add log ([](https://github.com/omnixys/observability/commit/a1d07a3bf61c06d492d61bfc28a02cc536563c68))

## [1.4.2](https://github.com/omnixys/observability/compare/v1.4.1...v1.4.2) (2026-03-18)

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/observability ([](https://github.com/omnixys/observability/commit/09ceccaf90c841280af614473729bbda84adabe0))

### U

* **U:** update ([](https://github.com/omnixys/observability/commit/678e9cba0c7371babf68f2c24d3a620f4b123a70))

## [1.4.1](https://github.com/omnixys/observability/compare/v1.4.0...v1.4.1) (2026-03-18)

### Logger

* **Logger:** update logger ([](https://github.com/omnixys/observability/commit/92bc8d35712f92296d94ac453eee4b7dc8edba56))

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/observability ([](https://github.com/omnixys/observability/commit/f4bc803e7d1e7ad2f67230a5ac6cfa06975c98c4))

## [1.4.0](https://github.com/omnixys/observability/compare/v1.3.3...v1.4.0) (2026-03-18)

### Other

* **Other:** fix(logger) add Scopped Logger ([](https://github.com/omnixys/observability/commit/60e1bd8cdbfaefce26def47e16f502237ad8f7d2))
* **Other:** fix(logger) add Scopped Logger ([](https://github.com/omnixys/observability/commit/f47f9586c704ec9e1c0e39abaa63310f8b7c8b16))
* **Other:** fix/realese): fix release ([](https://github.com/omnixys/observability/commit/a753d601e6c3a30aea5e1bf7750ff84e8e97af24))
* **Other:** Merge branch 'main' of https://github.com/omnixys/observability ([](https://github.com/omnixys/observability/commit/6e52d55e8fd8ff75efe2de3780daedeba649a7d4))

### Release

* **Release:** new release ([](https://github.com/omnixys/observability/commit/91aab3fa73429c4eba3e40dbf957344f5d9a38a6))

## [1.3.3](https://github.com/omnixys/observability/compare/v1.3.2...v1.3.3) (2026-03-18)

### Tracing

* **Tracing:** add tracing.interceptor to index.ts ([](https://github.com/omnixys/observability/commit/e33233c152f744acf0aff5e87dd9dd9ef4ae3ade))

## [1.3.2](https://github.com/omnixys/observability/compare/v1.3.1...v1.3.2) (2026-03-18)

### Tracing

* **Tracing:** add tracing.interceptor ([](https://github.com/omnixys/observability/commit/ab57ae288032ac998e747b004bb68fc8a9e87876))

## [1.3.1](https://github.com/omnixys/observability/compare/v1.3.0...v1.3.1) (2026-03-18)

### Index

* **Index:** update index.ts ([](https://github.com/omnixys/observability/commit/11200ec646611b542392b40e5a26cbea3b4ee866))

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/observability ([](https://github.com/omnixys/observability/commit/43e985207da4876d8989bd1c271c5c10ccf2768a))

## [1.3.0](https://github.com/omnixys/observability/compare/v1.2.0...v1.3.0) (2026-03-18)

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/observability ([](https://github.com/omnixys/observability/commit/1ac2db63ccae377443e494475ad9d96d743ae9b9))

### Tracing

* **Tracing:** create tracing context ([](https://github.com/omnixys/observability/commit/21bc6b417b44814ac4490a40e318ee5bca3236c4))

## [1.2.0](https://github.com/omnixys/observability/compare/v1.1.0...v1.2.0) (2026-03-18)

### Logger

* **Logger:** add logger ([](https://github.com/omnixys/observability/commit/d00de09a88c3ee11ea966b8a80b2d3545bc14564))

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/observability ([](https://github.com/omnixys/observability/commit/df3ddd7a53b9e2e36c389e9c6cdfe44eec96f765))

## [1.1.0](https://github.com/omnixys/observability/compare/v1.0.2...v1.1.0) (2026-03-17)

### Observability

* **Observability:** finalize pino logger configuration with typed transports and env handling ([](https://github.com/omnixys/observability/commit/e514c8c003ada90048f24dbb77a1da2755303d15))

## [1.0.2](https://github.com/omnixys/observability/compare/v1.0.1...v1.0.2) (2026-03-17)

### Package

* **Package:** update package ([](https://github.com/omnixys/observability/commit/3698ff658cd2e06ab41601e9051c4e33cbba778e))

## [1.0.1](https://github.com/omnixys/observability/compare/v1.0.0...v1.0.1) (2026-03-17)

### Logger

* **Logger:** update logger ([](https://github.com/omnixys/observability/commit/d742110a049368761f985a5e1b063df210ff2987))

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/observability ([](https://github.com/omnixys/observability/commit/bd75c4f441f9bbd0e4011acd3955b23e815e6ef6))

## 1.0.0 (2026-03-17)

### ⚠ BREAKING CHANGE

* **Observability:** - replaces previous logging and tracing setup
- services must use ObservabilityModule.forRoot(...)
- logger API changed to scoped logger via logger.child(...)
- env-based configuration removed in favor of module options

### Observability

* **Observability:** introduce unified observability module with logger, tracing and otel integration ([](https://github.com/omnixys/observability/commit/73964545b6fe51a4f29873e43438b8b904c0db0b))

### Other

* **Other:** Initial commit ([](https://github.com/omnixys/observability/commit/6a0de94fd45f1eedc8b9cf43fda6da8acba7426d))
