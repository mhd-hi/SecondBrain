// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { redactMcpSecrets } from '@/lib/mcp/redact';

// Only initialize Sentry in production
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || undefined,

    integrations: [
      Sentry.consoleLoggingIntegration({
        levels: ['log', 'warn', 'error'],
      }),
      // nodeProfilingIntegration() removed — its native NAPI addon calls
      // uv_default_loop, which Bun doesn't support (crashes process on init, bun#18546).
      // Re-add once Bun supports the libuv function, or switch runtime off Bun.
    ],

    beforeSend(event) {
      return redactMcpSecrets(event) as typeof event;
    },

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 0.1,

    // Enable logs to be sent to Sentry
    enableLogs: true,
    debug: false,
  });
}
