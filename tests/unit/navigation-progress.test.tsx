import * as React from 'react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable route state so rerender can simulate a committed navigation.
let currentPathname = '/';
const searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => searchParams,
}));

const { NavigationProgress } = await import(
  '@/components/shared/Navigation/NavigationProgress'
);
const { renderComponent } = await import('../helpers/render-utils');

function flushMicrotasks() {
  return act(async () => {
    await Promise.resolve();
  });
}

describe('NavigationProgress', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    currentPathname = '/';
  });

  it('shows the bar after pushState and hides when the route commits', async () => {
    const view = renderComponent(<NavigationProgress />);
    await view.render();

    expect(document.querySelector('[role="progressbar"]')).toBeNull();

    // Next's router calls pushState during commits; the component must not
    // throw synchronously and must defer the state update past the commit.
    expect(() => window.history.pushState({}, '', '/pomodoro')).not.toThrow();

    await flushMicrotasks();

    expect(document.querySelector('[role="progressbar"]')).not.toBeNull();

    // Route commits: pathname change hides the bar.
    currentPathname = '/pomodoro';
    await view.rerender(<NavigationProgress />);
    await flushMicrotasks();

    expect(document.querySelector('[role="progressbar"]')).toBeNull();

    await view.unmount();

    // Unmount restores the original (bound) pushState, not the patch.
    expect(String(window.history.pushState.name)).toContain('pushState');
  });

  it('ignores hash-only pushes (task deep links like /courses/abc#task-1)', async () => {
    const view = renderComponent(<NavigationProgress />);
    await view.render();

    window.history.pushState({}, '', '/courses/abc');
    await flushMicrotasks();

    expect(document.querySelector('[role="progressbar"]')).not.toBeNull();

    // Route commits: pathname change hides the bar.
    currentPathname = '/courses/abc';
    await view.rerender(<NavigationProgress />);
    await flushMicrotasks();

    expect(document.querySelector('[role="progressbar"]')).toBeNull();

    // Hash-only jump commits no new route: the bar must stay hidden.
    window.history.pushState({}, '', '/courses/abc#task-1');
    await flushMicrotasks();

    expect(document.querySelector('[role="progressbar"]')).toBeNull();

    // Identical push likewise commits nothing: the bar must stay hidden.
    window.history.pushState({}, '', '/courses/abc#task-1');
    await flushMicrotasks();

    expect(document.querySelector('[role="progressbar"]')).toBeNull();

    await view.unmount();
    window.history.pushState({}, '', '/');
    currentPathname = '/';
  });

  it('ignores commit-time pushes whose target already committed', async () => {
    const view = renderComponent(<NavigationProgress />);
    await view.render();

    // Route already committed before Next pushes state for it.
    currentPathname = '/kanban';
    await view.rerender(<NavigationProgress />);
    await flushMicrotasks();

    window.history.pushState({}, '', '/kanban');
    await flushMicrotasks();

    expect(document.querySelector('[role="progressbar"]')).toBeNull();

    await view.unmount();
    window.history.pushState({}, '', '/');
    currentPathname = '/';
  });
});
