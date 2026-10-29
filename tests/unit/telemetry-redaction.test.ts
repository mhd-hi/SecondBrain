import { afterEach, expect, it, vi } from 'vitest';

const { init, replay } = vi.hoisted(() => ({
  init: vi.fn<(options: Record<string, unknown>) => void>(),
  replay: vi.fn<(options: Record<string, unknown>) => object>(() => ({})),
}));

vi.mock('@sentry/nextjs', () => ({
  init,
  replayIntegration: replay,
  consoleLoggingIntegration: () => ({}),
  captureConsoleIntegration: () => ({}),
  browserTracingIntegration: () => ({}),
  browserProfilingIntegration: () => ({}),
  captureRouterTransitionStart: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

it('sanitizes each Sentry transport and masks replay inputs/text', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  await import('../../sentry.server.config');
  await import('../../sentry.edge.config');
  await import('../../src/instrumentation-client');

  expect(init).toHaveBeenCalledTimes(3);

  for (const [options] of init.mock.calls) {
    for (const hook of ['beforeSend', 'beforeSendTransaction', 'beforeSendLog', 'beforeBreadcrumb']) {
      const sanitize = options[hook] as (event: unknown) => unknown;
      const output = JSON.stringify(sanitize({ message: 'Bearer private-token', extra: { password: 'private-password' } }));

      expect(output).not.toContain('private-token');
      expect(output).not.toContain('private-password');
    }
  }

  const replayOptions = replay.mock.calls[0]![0];

  expect(replayOptions.maskAllInputs).toBe(true);
  expect(replayOptions.maskAllText).toBe(true);

  const sanitizeReplay = replayOptions.beforeAddRecordingEvent as (event: unknown) => unknown;

  expect(JSON.stringify(sanitizeReplay({ data: { message: 'token=private-token' } }))).not.toContain('private-token');
});
