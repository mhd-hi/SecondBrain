'use client';

import type { PomodoroStage } from '@/types/pomodoro';
import { Pause, Play, Plus, Square } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { QuoteBubble } from '@/components/shared/QuoteBubble';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_WORK_DURATION, usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { StreakBadge } from '../shared/atoms/StreakBadge';
import { DurationSelector } from './DurationSelector';

export function PomodoroContainer() {
  const {
    isRunning,
    timeLeftSec,
    totalTimeSec,
    pomodoroStage,
    sessionDurations,
    isPomodoroActive,
    streak,
    toggleTimer,
    stopPomodoro,
    addFiveMinutes,
    switchToPomodoroStage,
    updateDuration,
    fetchStreak,
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

  // Fetch streak on mount
  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

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

  return (
    <div className="relative max-w-3xl mx-auto space-y-6">
      {/* Main Pomodoro Session Card */}
      <div className="relative">
        <Card className="border-2">
          <CardContent className="space-y-6 mt-7">
          {/* Pomodoro Stage Tabs */}
          <div className="flex justify-center px-2">
            <Tabs value={pomodoroStage} onValueChange={value => switchToPomodoroStage(value as PomodoroStage)}>
              <TabsList className="flex flex-col md:grid w-full max-w-md md:grid-cols-3 h-auto min-h-10 bg-muted/50 p-1 rounded-xl gap-2 md:gap-0">
                <TabsTrigger
                  value="work"
                  className="h-auto min-h-8 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border-0 transition-colors duration-200 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md"
                >
                  Pomodoro
                </TabsTrigger>
                <TabsTrigger
                  value="shortBreak"
                  className="h-auto min-h-8 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border-0 transition-colors duration-200 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md"
                >
                  Short Break
                </TabsTrigger>
                <TabsTrigger
                  value="longBreak"
                  className="h-auto min-h-8 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border-0 transition-colors duration-200 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md"
                >
                  Long Break
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Timer Display */}
          <div className="text-center space-y-4">
            {showDurationSelector
              ? (
                <DurationSelector
                  duration={currentDuration}
                  onDurationChange={updateDuration}
                />
              )
              : (
                <div className="text-foreground flex h-16 items-center justify-center font-mono text-6xl font-bold">
                  {formatTime(timeLeftSec)}
                </div>
              )}

            {/* Progress bar */}
            <div className="mx-8 sm:mx-12 md:mx-16 lg:mx-20">
              <div className="bg-muted mb-4 h-1.5 w-full rounded-full">
                <div
                  className={`h-1.5 rounded-full transition-all duration-1000 
                    ${pomodoroStage === 'work' ? 'bg-blue-500' : 'bg-green-500'}`}
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
            </div>
          </div>

          {/* Session Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <Button
                onClick={handlePlayClick}
                variant="outline"
                size="lg"
                className="pomodoro-button flex h-16 w-16 items-center justify-center rounded-full shadow-md"
              >
                {isRunning ? <Pause className="h-6 w-6" /> : <Play className="ml-1 h-6 w-6" />}
              </Button>

              <Button
                onClick={stopPomodoro}
                variant="outline"
                size="lg"
                className="flex h-16 w-16 items-center justify-center rounded-full shadow-lg"
              >
                <Square className="h-6 w-6" />
              </Button>

              <Button
                onClick={handleAddFiveMinutes}
                variant="outline"
                size="lg"
                className="flex h-16 w-16 items-center justify-center rounded-full shadow-lg"
                title="Add 5 minutes"
              >
                <div className="flex flex-col items-center gap-1">
                  <Plus className="h-4 w-4" />
                  <span className="text-xs leading-none">5min</span>
                </div>
              </Button>
            </div>
          </div>

          <StreakBadge streak={streak ?? 0} />
          </CardContent>
        </Card>

        <QuoteBubble className="pointer-events-auto mt-7 justify-items-end" />
      </div>

    </div>
  );
}
