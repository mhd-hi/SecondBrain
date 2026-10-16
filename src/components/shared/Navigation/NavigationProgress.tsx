'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import * as React from 'react';

// Same pathname + search means no new route commits (hash-only task deep
// links like /courses/abc#task-xyz, or identical pushes). Unparseable URLs
// return false so the bar still shows (old behavior) instead of getting stuck.
function isSameDocument(href: string, base: string) {
  try {
    const target = new URL(href, base);
    const current = new URL(base);
    return target.pathname === current.pathname && target.search === current.search;
  } catch {
    return false;
  }
}

function resolveHref(url: unknown): string | null {
  if (url == null) {
    return null;
  }
  try {
    return new URL(String(url), window.location.href).href;
  } catch {
    return null;
  }
}

// "pathname?search" in the same shape as routeKey below, or null when unknown.
function keyOfHref(href: string | null): string | null {
  if (href === null) {
    return null;
  }
  try {
    const url = new URL(href, window.location.href);
    return `${url.pathname}?${url.searchParams.toString()}`;
  } catch {
    return null;
  }
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHrefRef = React.useRef<string | null>(null);
  const wantedKeyRef = React.useRef<string | null>(null);

  // Hide once the new route commits.
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const routeKeyRef = React.useRef(routeKey);
  routeKeyRef.current = routeKey;

  const start = React.useCallback((key: string | null) => {
    wantedKeyRef.current = key;
    // Next's router calls history.pushState inside its own useInsertionEffect
    // during commits; setState synchronously in that context throws
    // "useInsertionEffect must not schedule updates". Defer past the commit.
    queueMicrotask(() => {
      // Superseded by a newer navigation, or the target already committed
      // (Next pushes state at commit time): showing now would stick the bar
      // with nothing left to hide it.
      if (wantedKeyRef.current !== key) {
        return;
      }
      if (key !== null && key === routeKeyRef.current) {
        return;
      }
      setPending(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      // ponytail: fixed 10s ceiling, clear and re-navigate if a route hangs longer
      timerRef.current = setTimeout(() => setPending(false), 10_000);
    });
  }, []);

  React.useEffect(() => {
    setPending(false);
    wantedKeyRef.current = null;
    lastHrefRef.current = window.location.href;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [routeKey]);

  React.useEffect(() => {
    lastHrefRef.current ??= window.location.href;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//') || anchor.target === '_blank' || anchor.hasAttribute('download')) {
        return;
      }
      try {
        const url = new URL(href, window.location.href);
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }
        start(`${url.pathname}?${url.searchParams.toString()}`);
      } catch {
        // Invalid hrefs cannot start a route transition.
      }
    };

    const originalPushState = window.history.pushState.bind(window.history);
    window.history.pushState = (...args) => {
      const target = resolveHref(args[2]);
      if (target !== null && isSameDocument(target, window.location.href)) {
        return originalPushState(...args);
      }
      if (target !== null) {
        lastHrefRef.current = target;
      }
      start(keyOfHref(target));
      return originalPushState(...args);
    };
    const onPopState = () => {
      const previous = lastHrefRef.current;
      lastHrefRef.current = window.location.href;
      if (previous !== null && isSameDocument(window.location.href, previous)) {
        return;
      }
      start(keyOfHref(window.location.href));
    };
    window.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.history.pushState = originalPushState;
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [start]);

  if (!pending) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[100] h-0.5" role="progressbar" aria-label="Loading page">
      <style>{'@keyframes nav-progress-slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}'}</style>
      <div
        className="h-full w-1/3 bg-primary"
        style={{ animation: 'nav-progress-slide 1s ease-in-out infinite' }}
      />
    </div>
  );
}
