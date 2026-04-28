// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

// Only initialize Sentry in production
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || 'https://84a35e8c25e5f711b2f3bb4937f821d5@o4510168702451712.ingest.de.sentry.io/4510168702845008',

    // Add optional integrations for additional features
    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        maskAllInputs: false,
        blockAllMedia: false,
      }),
      Sentry.browserTracingIntegration(),
      Sentry.browserProfilingIntegration(),
      // Only send console.error and console.warn calls as logs to Sentry
      Sentry.consoleLoggingIntegration({
        levels: ['log', 'warn', 'error'],
      }),
    ],

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 0.1,

    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/.*\.vercel\.app/,
      // Add your self-hosted domain here when deploying
      ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
      // Fallback: enable for any HTTPS API calls from same origin
      /^https:\/\/[^/]*\/api/,
    ],

    // Set profilesSampleRate to 0.1 to profile 10% of transactions.
    // Since profilesSampleRate is relative to tracesSampleRate,
    // the final profiling rate is tracesSampleRate * profilesSampleRate
    // For example, 0.1 * 0.1 = 0.01 (1% of transactions being profiled)
    profilesSampleRate: 0.5,
    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Define how likely Replay events are sampled.
    // This sets the sample rate to be 10%. You may want this to be 100% while
    // in development and sample at a lower rate in production
    replaysSessionSampleRate: 0.1,

    // Define how likely Replay events are sampled when an error occurs.
    replaysOnErrorSampleRate: 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
