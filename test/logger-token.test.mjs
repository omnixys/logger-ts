import { LoggerModule, OmnixysLogger } from '../dist/index.js';
import { OMNIXYS_LOGGER } from '@omnixys/logger-ts/token';
import assert from 'node:assert/strict';
import test from 'node:test';

test('logger module exports a lightweight alias for the canonical logger', () => {
  const module = LoggerModule.forRoot({ serviceName: 'test' });
  const alias = module.providers.find(
    (provider) => typeof provider === 'object' && provider.provide === OMNIXYS_LOGGER,
  );

  assert.equal(alias.useExisting, OmnixysLogger);
  assert.ok(module.exports.includes(OMNIXYS_LOGGER));
});
