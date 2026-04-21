import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/lib/page-routes';
import { ensureHappyDom } from '../helpers/runtime';

const routerPushMock = vi.fn();
const signInCardMock = vi.fn((_props?: unknown) => null);
let mockStatus: 'authenticated' | 'loading' | 'unauthenticated' = 'unauthenticated';
let mockCallbackUrl: string | null = null;

function renderComponent(ui: React.ReactElement) {
  const container = document.createElement('div');
  const root = createRoot(container);

  return {
    async render() {
      // We mount through ReactDOM directly in this helper, so manual act is required.
      // eslint-disable-next-line testing-library/no-unnecessary-act
      await act(async () => {
        root.render(ui);
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
    },
  };
}

describe('sign-in page callback URL handling', () => {
  beforeEach(() => {
    ensureHappyDom();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetModules();
    vi.clearAllMocks();
    mockStatus = 'unauthenticated';
    mockCallbackUrl = null;
    window.location.href = 'https://app.example.com/auth/signin';

    vi.doMock('next-auth/react', () => ({
      useSession: vi.fn(() => ({ status: mockStatus })),
    }));
    vi.doMock('next/navigation', () => ({
      useRouter: vi.fn(() => ({ push: routerPushMock })),
      useSearchParams: vi.fn(() => ({
        get: (key: string) => key === 'callbackUrl' ? mockCallbackUrl : null,
      })),
    }));
    vi.doMock('@/components/shared/SignInCard', () => ({
      SignInCard: (props: unknown) => signInCardMock(props),
    }));
    vi.doMock('@/components/shared/CapybaraLoader', () => ({
      CapybaraLoader: () => null,
    }));
    vi.doMock('@/components/ui/card', () => ({
      Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    }));
  });

  afterEach(() => {
    mockStatus = 'unauthenticated';
    mockCallbackUrl = null;
  });

  it('passes a normalized internal callback URL to the sign-in card', async () => {
    mockCallbackUrl = 'https://evil.example.com/phish';
    const { default: SignInPage } = await import('@/app/auth/signin/page');
    const view = renderComponent(<SignInPage />);

    try {
      await view.render();

      expect(signInCardMock).toHaveBeenCalledWith(
        expect.objectContaining({
          callbackUrl: ROUTES.DASHBOARD,
        }),
      );
    } finally {
      await view.unmount();
    }
  });

  it('redirects authenticated users to the normalized callback URL', async () => {
    mockStatus = 'authenticated';
    mockCallbackUrl = 'https://evil.example.com/phish';
    const { default: SignInPage } = await import('@/app/auth/signin/page');
    const view = renderComponent(<SignInPage />);

    try {
      await view.render();

      expect(routerPushMock).toHaveBeenCalledWith(ROUTES.DASHBOARD);
    } finally {
      await view.unmount();
    }
  });
});
