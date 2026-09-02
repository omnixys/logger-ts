import process from 'node:process';

import {
  isSensitiveLogKey,
  shouldRedactLogs,
} from './log-redaction.js';

export const LOG_ENV_SECTION_ORDER = [
  'LOGGER',
  'KEYCLOAK',
  'HEALTH',
  'KAFKA',
  'CACHE',
  'STORAGE',
  'GRPC',
  'GEOCODING',
  'DATABASE',
  'SUBGRAPHS',
  'OBSERVABILITY',
  'GENERAL',
] as const;

export type LogEnvSection =
  (typeof LOG_ENV_SECTION_ORDER)[number];

export interface DisplayLogValueOptions {
  readonly nodeEnv?: string;
}

export function getLogEnvSection(
  key: string,
): LogEnvSection {
  if (
    key.startsWith('KC_') ||
    key.startsWith('KEYCLOAK_')
  ) {
    return 'KEYCLOAK';
  }

  if (key.startsWith('HEALTH_')) {
    return 'HEALTH';
  }

  if (key.startsWith('KAFKA_')) {
    return 'KAFKA';
  }

  if (
    key.startsWith('VALKEY_') ||
    key.startsWith('RATE_LIMIT_')
  ) {
    return 'CACHE';
  }

  if (key.startsWith('STORAGE_')) {
    return 'STORAGE';
  }

  if (key.includes('GRPC')) {
    return 'GRPC';
  }

  if (key.startsWith('GEOCODING_')) {
    return 'GEOCODING';
  }

  if (key === 'DATABASE_URL') {
    return 'DATABASE';
  }

  if (
    key.startsWith('ANALYTICS_') ||
    key.startsWith('AUTHENTICATION_') ||
    key.startsWith('EVENT_') ||
    key.startsWith('INVITATION_') ||
    key.startsWith('TICKET_') ||
    key.startsWith('NOTIFICATION_') ||
    key.startsWith('USER_') ||
    key.startsWith('SEAT_') ||
    key.startsWith('ADDRESS_') ||
    key.startsWith('CHAT_') ||
    key.startsWith('COMMUNICATION_GATEWAY_') ||
    key.startsWith('SUPERGRAPH_')
  ) {
    return 'SUBGRAPHS';
  }

  if (
    key.startsWith('OTEL_') ||
    key.startsWith('TEMPO_') ||
    key.startsWith('PROMETHEUS_')
  ) {
    return 'OBSERVABILITY';
  }

  return 'GENERAL';
}

export function displayLogEnvValue(
  key: string,
  value: unknown,
  options: DisplayLogValueOptions = {},
): string {
  const stringValue = String(value);

  if (!isSensitiveLogKey(key)) {
    return stringValue;
  }

  const nodeEnv =
    options.nodeEnv ??
    process.env.NODE_ENV;

  if (!shouldRedactLogs(nodeEnv)) {
    return stringValue;
  }

  return '[REDACTED]';
}