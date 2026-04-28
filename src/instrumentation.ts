export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export async function onRequestError(...args: unknown[]) {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const Sentry = await import('@sentry/nextjs');

  Sentry.captureRequestError(...args as Parameters<typeof Sentry.captureRequestError>);
}
