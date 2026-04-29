'use client';

import type { PomodoroStage } from '@/types/pomodoro';
import { Pause, Play, Plus, Square } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { QuoteBubble } from '@/components/shared/QuoteBubble';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_WORK_DURATION, usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { DurationSelector } from './DurationSelector';

export function PomodoroContainer() {
  const {
    isRunning,
    timeLeftSec,
    totalTimeSec,
    pomodoroStage,
    sessionDurations,
    isPomodoroActive,
    toggleTimer,
    stopPomodoro,
    addFiveMinutes,
    switchToPomodoroStage,
    updateDuration,
  } = usePomodoroStore();

  // Compute current duration reactively from sessionDurations
  const currentDuration = Object.hasOwn(sessionDurations, pomodoroStage)
    ? sessionDurations[pomodoroStage]
    : DEFAULT_WORK_DURATION;

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Update page title with timer when running
  useEffect(() => {
    if (isPomodoroActive && timeLeftSec > 0) {
      const formattedTime = formatTime(timeLeftSec);
      const typeLabel = pomodoroStage === 'work' ? '🍅' : '☕';
      document.title = `${formattedTime} ${typeLabel} - Pomodoro`;
    } else {
      document.title = 'Pomodoro - SecondBrain';
    }

    // Restore title on unmount
    return () => {
      document.title = 'Pomodoro - SecondBrain';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPomodoroActive, timeLeftSec, pomodoroStage]);

  const getProgress = () => {
    return ((totalTimeSec - timeLeftSec) / totalTimeSec) * 100;
  };

  // Show duration selector when not running and at the start of any pomodoro session
  const showDurationSelector = !isRunning && timeLeftSec === totalTimeSec;

  const handlePlayClick = () => {
    // If pomodoro session is not active, we need to start it first
    if (!isPomodoroActive) {
      // This will activate the pomodoro session with current duration
      switchToPomodoroStage(pomodoroStage);
    }
    toggleTimer();
  };

  const handleAddFiveMinutes = () => {
    // If timer is not running and we're at the start of a pomodoro session, add to duration selector
    if (!isRunning && timeLeftSec === totalTimeSec && pomodoroStage === 'work') {
      const newDuration = currentDuration + 5;
      updateDuration(newDuration);
    } else {
      // Otherwise, add to the running timer
      addFiveMinutes();
    }
  };

  const sessionPrompt = pomodoroStage === 'work'
    ? `Start a ${Math.round(currentDuration)}-minute focus session`
    : pomodoroStage === 'shortBreak'
      ? 'Take a short reset before the next sprint'
      : 'Step away for a longer break';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <Card className="overflow-hidden rounded-2xl border-border/70 bg-card/95 shadow-sm">
        <CardContent className="space-y-6 p-5 sm:p-6">
          <div className="flex justify-center">
            <Tabs value={pomodoroStage} onValueChange={value => switchToPomodoroStage(value as PomodoroStage)}>
              <TabsList className="flex h-auto min-h-10 w-full max-w-md flex-col gap-2 rounded-xl bg-muted/50 p-1 md:grid md:grid-cols-3 md:gap-0">
                <TabsTrigger
                  value="work"
                  className="h-auto min-h-8 rounded-lg border-0 px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:px-3 sm:text-sm"
                >
                  Pomodoro
                </TabsTrigger>
                <TabsTrigger
                  value="shortBreak"
                  className="h-auto min-h-8 rounded-lg border-0 px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:px-3 sm:text-sm"
                >
                  Short Break
                </TabsTrigger>
                <TabsTrigger
                  value="longBreak"
                  className="h-auto min-h-8 rounded-lg border-0 px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:px-3 sm:text-sm"
                >
                  Long Break
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-4 text-center">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {pomodoroStage === 'work' ? 'Focus session' : 'Recovery session'}
              </p>
              <p className="text-sm text-muted-foreground">
                {sessionPrompt}
              </p>
            </div>

            {showDurationSelector
              ? (
                <DurationSelector
                  duration={currentDuration}
                  onDurationChange={updateDuration}
                />
              )
              : (
                <div className="text-foreground flex h-16 items-center justify-center font-mono text-7xl font-bold sm:text-6xl">
                  {formatTime(timeLeftSec)}
                </div>
              )}

            <div className="mx-auto max-w-xl px-2 sm:px-6">
              <div className="bg-muted/80 h-2 w-full rounded-full">
                <div
                  className={`h-2 rounded-full transition-all duration-1000
                    ${pomodoroStage === 'work' ? 'bg-blue-500' : 'bg-green-500'}`}
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 pt-5">
            <div className="flex items-center justify-center gap-4">
              <Button
                onClick={handlePlayClick}
                variant="outline"
                size="lg"
                className="pomodoro-button flex h-16 w-16 items-center justify-center rounded-full shadow-sm"
              >
                {isRunning ? <Pause className="h-6 w-6" /> : <Play className="ml-1 h-6 w-6" />}
              </Button>

              <Button
                onClick={stopPomodoro}
                variant="outline"
                size="lg"
                className="flex h-16 w-16 items-center justify-center rounded-full shadow-sm"
              >
                <Square className="h-6 w-6" />
              </Button>

              <Button
                onClick={handleAddFiveMinutes}
                variant="outline"
                size="lg"
                className="flex h-16 w-16 items-center justify-center rounded-full shadow-sm"
                title="Add 5 minutes"
              >
                <div className="flex flex-col items-center gap-1">
                  <Plus className="h-4 w-4" />
                  <span className="text-xs leading-none">5min</span>
                </div>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <QuoteBubble className="pointer-events-auto" />
    </div>
  );
}
