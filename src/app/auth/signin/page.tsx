'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { CapybaraLoader } from '@/components/shared/CapybaraLoader';
import { SignInCard } from '@/components/shared/SignInCard';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/lib/page-routes';
import { normalizeCallbackUrl } from '@/lib/utils/auth/callback-url';

function SignInContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get('callbackUrl');
  const callbackUrl = React.useMemo(() => normalizeCallbackUrl(rawCallbackUrl, {
    baseUrl: typeof window === 'undefined' ? undefined : window.location.origin,
    fallbackPath: ROUTES.DASHBOARD,
  }), [rawCallbackUrl]);

  React.useEffect(() => {
    if (status === 'authenticated') {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CapybaraLoader />
      </div>
    );
  }

  if (status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-6 text-center">
            <div className="flex justify-center mb-4">
              <CapybaraLoader />
            </div>
            <p>Redirecting...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignInCard
        title="Welcome to SecondBrain ETS"
        className="shadow-lg border-0"
        callbackUrl={callbackUrl}
      />
    </div>
  );
}

export default function SignInPage() {
  return (
    <React.Suspense
      fallback={(
        <div className="min-h-screen flex items-center justify-center">
          <CapybaraLoader />
        </div>
      )}
    >
      <SignInContent />
    </React.Suspense>
  );
}
