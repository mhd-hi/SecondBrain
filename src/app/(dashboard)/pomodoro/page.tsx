import { and, eq, gte, lte } from 'drizzle-orm';
import { Settings } from 'lucide-react';
import Link from 'next/link';
import { PomodoroContainer } from '@/components/Pomodoro/PomodoroContainer';
import { PomodoroHistoryGraph } from '@/components/Pomodoro/PomodoroHistoryGraph';
import { Button } from '@/components/ui/button';
import { getPreferencesPath } from '@/lib/page-routes';
import { startOfPomodoroDay } from '@/lib/pomodoro/date';
import { db } from '@/server/db';
import { pomodoroDaily } from '@/server/db/schema';
import { auth } from '@/server/auth';

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default async function PomodoroPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const today = startOfPomodoroDay(new Date());
  const startDate = addDays(today, -364);

  const historyRows = userId
    ? await db
      .select({
        day: pomodoroDaily.day,
        totalMinutes: pomodoroDaily.totalMinutes,
      })
      .from(pomodoroDaily)
      .where(and(
        eq(pomodoroDaily.userId, userId),
        gte(pomodoroDaily.day, startDate),
        lte(pomodoroDaily.day, today),
      ))
    : [];

  return (
    <main className="container mx-auto mt-2 flex flex-col gap-6 px-4 sm:px-6 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            🍅 Pomodoro
          </h1>
          <p className="text-muted-foreground mt-2">
            Focus Session with the Pomodoro Technique
          </p>
        </div>
        <div>
          <Link href={getPreferencesPath('pomodoro')}>
            <Button variant="ghost" size="icon" aria-label="Pomodoro settings">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5">
        <PomodoroContainer />
        <PomodoroHistoryGraph rows={historyRows} />
      </section>
    </main>
  );
}
