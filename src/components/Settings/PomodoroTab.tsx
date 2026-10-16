'use client';

import type { SoundStorageKey } from '@/lib/sound-manager';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { SOUND_OPTIONS, soundManager } from '@/lib/sound-manager';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { playSelectedNotificationSound } from '@/lib/utils/audio-util';

export function PomodoroTab() {
  const { sessionDurations, settings, updateSessionDuration, updateSettings } = usePomodoroStore();
  const [soundReady, setSoundReady] = useState(soundManager.isReady());
  const [isTestPlaying, setIsTestPlaying] = useState(false);

  // Monitor sound manager readiness via event listener
  useEffect(() => {
    // Subscribe to ready state changes
    const unsubscribe = soundManager.onReadyStateChange((ready) => {
      setSoundReady(ready);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const testNotificationSound = useCallback(async () => {
    if (isTestPlaying) {
      soundManager.stop();
      setIsTestPlaying(false);
    } else {
      const normalizedVolume = Math.max(0, Math.min(1, settings.soundVolume / 100));
      await playSelectedNotificationSound(settings.notificationSound, normalizedVolume);
      setIsTestPlaying(true);
      // Stop after a reasonable time to reset the state
      setTimeout(() => setIsTestPlaying(false), 5000);
    }
  }, [settings.notificationSound, settings.soundVolume, isTestPlaying]);

  // settings.notificationSound is stored as a storage key (e.g. 'sax' or 'none')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold pb-0 mb-0">Pomodoro</CardTitle>
        <CardDescription>
          Configure your focus timer preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timer Durations */}
        <div className="space-y-4">
          {/* Work Duration */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Label className="text-base">Pomodoro</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="5"
                step="5"
                value={sessionDurations.work}
                onChange={e => updateSessionDuration('work', Number.parseInt(e.target.value) || 25)}
                className="w-20 text-center"
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
          </div>

          {/* Short Break Duration */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="space-y-0.5">
              <Label className="text-base">Short Break</Label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="5"
                step="5"
                value={sessionDurations.shortBreak}
                onChange={e => updateSessionDuration('shortBreak', Number.parseInt(e.target.value) || 5)}
                className="w-20 text-center"
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
          </div>

          {/* Long Break Duration */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Label className="text-base">Long Break</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="5"
                step="5"
                value={sessionDurations.longBreak}
                onChange={e => updateSessionDuration('longBreak', Number.parseInt(e.target.value) || 15)}
                className="w-20 text-center"
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
          </div>
        </div>

        {/* Sound Settings */}
        <div className="text-lg font-semibold pb-0 mb-0">Alarm</div>
        <div className="text-sm text-muted-foreground">
          Alarm when a pomodoro session is completed
        </div>

        <div className="space-y-4">
          {/* Volume */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="space-y-0.5">
              <Label className="text-base">Alarm volume level</Label>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[settings.soundVolume]}
                onValueChange={(value) => {
                  const newVolume = value[0] || 10;
                  updateSettings({ soundVolume: newVolume });
                  // Update volume in real-time while sound is playing
                  if (isTestPlaying) {
                    const normalizedVolume = Math.max(0, Math.min(1, newVolume / 100));
                    soundManager.setVolume(normalizedVolume);
                  }
                }}
                max={100}
                step={10}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground w-10">
                {settings.soundVolume}
                %
              </span>
            </div>
          </div>

          {/* Notification Sound */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="space-y-0.5">
              <div className="text-sm text-muted-foreground">
                Choose your completion sound
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={settings.notificationSound}
                onValueChange={(value: SoundStorageKey) => updateSettings({ notificationSound: value })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOUND_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {soundReady && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testNotificationSound}
                >
                  {isTestPlaying ? 'Stop' : 'Test'}
                </Button>
              )}

              {!soundReady && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  Loading sounds...
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
