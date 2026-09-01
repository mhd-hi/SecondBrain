'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PomodoroTab } from './PomodoroTab';
import { McpConnectionsCard, ProfileTab } from './ProfileTab';

export function PreferencesContainer() {
  const searchParams = useSearchParams();
  const viewParam = searchParams?.get('view') ?? undefined;

  const defaultTab = useMemo(() => (viewParam === 'pomodoro' ? 'pomodoro' : 'profile'), [viewParam]);

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="profile" className="text-sm" tabIndex={0}>Profile</TabsTrigger>
        <TabsTrigger value="pomodoro" className="text-sm" tabIndex={0}>Pomodoro</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="space-y-6">
        <ProfileTab />
        <McpConnectionsCard />
      </TabsContent>

      <TabsContent value="pomodoro" className="space-y-6">
        <PomodoroTab />
      </TabsContent>
    </Tabs>
  );
}
