/* eslint-disable ts/no-explicit-any */
import type { Mock } from 'vitest';
import { redirect } from 'next/navigation';
import * as React from 'react';
import { isValidElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardLayout from '@/app/(dashboard)/layout';
import { ROUTES } from '@/lib/page-routes';
import { auth } from '@/server/auth';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  usePathname: vi.fn(() => '/dashboard'),
  useRouter: vi.fn(),
}));
vi.mock('@/app/(dashboard)/layout-content', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('dashboard layout auth guard', () => {
  it('redirects unauthenticated users to the sign-in page', async () => {
    const redirectError = new Error('redirect');
    (auth as unknown as Mock).mockResolvedValue(null as any);
    (redirect as unknown as Mock).mockImplementation(() => {
      throw redirectError;
    });

    await expect(DashboardLayout({ children: <div>Private</div> })).rejects.toBe(redirectError);

    expect(redirect).toHaveBeenCalledWith(ROUTES.SIGNIN);
  });

  it('renders the dashboard shell for authenticated users', async () => {
    (auth as unknown as Mock).mockResolvedValue({ user: { id: 'user-123' } } as any);

    const result = await DashboardLayout({ children: <span>Private</span> });

    expect(redirect).not.toHaveBeenCalled();
    expect(isValidElement(result)).toBe(true);
    expect(isValidElement(result.props.children)).toBe(true);

    if (isValidElement(result.props.children)) {
      expect(result.props.children.type).toBe('span');
      expect(result.props.children.props.children).toBe('Private');
    }
  });
});
