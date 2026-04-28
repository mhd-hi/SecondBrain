// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Only initialize Sentry in production
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || undefined,

    integrations: [
      Sentry.consoleLoggingIntegration({
        levels: ['log', 'warn', 'error'],
      }),
      nodeProfilingIntegration(),
    ],

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    // Tracing must be enabled for profiling to work
    tracesSampleRate: 0.1,
    // Set sampling rate for profiling - this is evaluated only once per SDK.init call
    profileSessionSampleRate: 0.1,
    // Trace lifecycle automatically enables profiling during active traces
    profileLifecycle: 'trace',

    // Enable logs to be sent to Sentry
    enableLogs: true,
    debug: false,
  });
}
