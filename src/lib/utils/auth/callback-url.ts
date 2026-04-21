import { ROUTES } from '@/lib/page-routes';

type NormalizeCallbackUrlOptions = {
  baseUrl?: string;
  fallbackPath?: string;
};

function normalizeInternalPath(path: string | undefined, fallbackPath: string) {
  if (!path) {
    return fallbackPath;
  }

  const trimmedPath = path.trim();

  if (!trimmedPath || !trimmedPath.startsWith('/') || trimmedPath.startsWith('//')) {
    return fallbackPath;
  }

  return trimmedPath;
}

export function normalizeCallbackUrl(
  callbackUrl: string | null | undefined,
  options: NormalizeCallbackUrlOptions = {},
) {
  const fallbackPath = normalizeInternalPath(
    options.fallbackPath,
    ROUTES.DASHBOARD,
  );

  if (!callbackUrl) {
    return fallbackPath;
  }

  const trimmedUrl = callbackUrl.trim();

  if (!trimmedUrl) {
    return fallbackPath;
  }

  if (trimmedUrl.startsWith('/')) {
    return trimmedUrl.startsWith('//') ? fallbackPath : trimmedUrl;
  }

  if (!options.baseUrl) {
    return fallbackPath;
  }

  try {
    const resolvedUrl = new URL(trimmedUrl);
    const trustedOrigin = new URL(options.baseUrl).origin;

    if (resolvedUrl.origin !== trustedOrigin) {
      return fallbackPath;
    }

    return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
  } catch {
    return fallbackPath;
  }
}

export function resolveCallbackUrl(
  callbackUrl: string,
  baseUrl: string,
  fallbackPath = ROUTES.DASHBOARD,
) {
  const normalizedPath = normalizeCallbackUrl(callbackUrl, {
    baseUrl,
    fallbackPath,
  });

  return new URL(normalizedPath, baseUrl).toString();
}
