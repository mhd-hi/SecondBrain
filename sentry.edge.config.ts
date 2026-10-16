// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { redactMcpSecrets } from '@/lib/mcp/redact';

// Only initialize Sentry in production
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || undefined,

    beforeSend(event) {
      return redactMcpSecrets(event) as typeof event;
    },
    beforeSendTransaction(event) {
      return redactMcpSecrets(event) as typeof event;
    },
    beforeSendLog(log) {
      return redactMcpSecrets(log) as typeof log;
    },
    beforeBreadcrumb(breadcrumb) {
      return redactMcpSecrets(breadcrumb) as typeof breadcrumb;
    },

    // Add optional integrations for additional features
    integrations: [
      Sentry.captureConsoleIntegration({ levels: ['error'] }),
      Sentry.consoleLoggingIntegration({
        levels: ['log', 'warn', 'error'],
      }),
    ],

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 0.1,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  });
}
