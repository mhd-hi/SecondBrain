import { Settings } from 'lucide-react';
import Link from 'next/link';
import { PomodoroContainer } from '@/components/Pomodoro/PomodoroContainer';
import { Button } from '@/components/ui/button';
import { getPreferencesPath } from '@/lib/page-routes';

export default function PomodoroPage() {
  return (
    <main className="container mx-auto px-4 sm:px-6 md:px-8 flex flex-col gap-4 sm:gap-3 mt-2">
      <div className="flex items-center justify-between">
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
      <section className="flex-1">
        <PomodoroContainer />
      </section>
    </main>
  );
}
