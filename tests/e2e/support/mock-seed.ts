import type { TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';

const FIXED_E2E_TIME = '2026-04-23T12:00:00.000Z';

function toUuid(hex: string) {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

export function buildE2ETestSeed(testInfo: TestInfo) {
  return testInfo.titlePath.join(' > ');
}

export function createDeterministicIdFactory(seed: string) {
  const counters = new Map<string, number>();

  return (namespace: string) => {
    const counter = counters.get(namespace) ?? 0;
    counters.set(namespace, counter + 1);

    const hex = createHash('sha256')
      .update(`${seed}:${namespace}:${counter}`)
      .digest('hex');

    return toUuid(hex);
  };
}

export class MockClock {
  private tick = 0;
  private readonly baseMs = Date.parse(FIXED_E2E_TIME);

  nextIso() {
    const next = new Date(this.baseMs + this.tick * 60_000).toISOString();
    this.tick += 1;
    return next;
  }

  sessionExpiresIso(maxAgeSeconds: number) {
    return new Date(this.baseMs + maxAgeSeconds * 1000).toISOString();
  }
}
