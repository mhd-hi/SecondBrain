'use client';

import { Settings } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { SettingsContainer } from '@/components/Settings/SettingsContainer';
import { CapybaraLoader } from '@/components/shared/CapybaraLoader';

export default function SettingsPage() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <CapybaraLoader />
      </div>
    );
  }

  return (
    <main className="container mx-auto px-8 flex min-h-screen flex-col gap-6 mt-2 mb-3.5">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="size-8" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings
        </p>
      </div>

      <SettingsContainer />
    </main>
  );
}
