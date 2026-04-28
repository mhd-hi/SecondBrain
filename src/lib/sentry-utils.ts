async function getSentry() {
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  return import('@sentry/core');
}

export const logger = {
  async info(message: string, context?: Record<string, unknown>) {
    const Sentry = await getSentry();

    Sentry?.logger.info(message, context);
  },
};

/**
 * Wrapper for Sentry.captureException with additional context
 */
export async function captureException(error: Error, context?: Record<string, unknown>) {
  const Sentry = await getSentry();

  if (!Sentry) {
    return;
  }

  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          scope.setTag(key, String(value));
        } else {
          scope.setExtra(key, value);
        }
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}
