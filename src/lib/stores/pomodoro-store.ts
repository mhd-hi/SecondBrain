import type { SoundStorageKey } from '@/lib/sound-manager';
import type { PomodoroStage } from '@/types/pomodoro';
import { toast } from 'sonner';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SOUND_DEFAULT_STORAGE, soundManager } from '@/lib/sound-manager';
import { api } from '@/lib/utils/api/api-client-util';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';
import { playSelectedNotificationSound } from '@/lib/utils/audio-util';

export const DEFAULT_WORK_DURATION = 25;
const DEFAULT_SHORT_BREAK_DURATION = 5;
const DEFAULT_LONG_BREAK_DURATION = 15;
const DEFAULT_SOUND_VOLUME = 60;
const LONG_BREAK_THRESHOLD = 45;

type SessionDurations = {
  work: number;
  shortBreak: number;
  longBreak: number;
};

type PomodoroSettings = {
  soundVolume: number;
  notificationSound: SoundStorageKey;
};

type CompletedSessionSnapshot = {
  pomodoroStage: PomodoroStage;
  totalTimeSec: number;
};

type PomodoroStore = {
  pomodoroStage: PomodoroStage;
  isPomodoroActive: boolean;
  isRunning: boolean;
  endsAtMs: number | null;
  timeLeftSec: number;
  totalTimeSec: number;
  sessionDurations: SessionDurations;
  settings: PomodoroSettings;
  isLoaded: boolean;

  startPomodoro: (duration?: number, autoStart?: boolean, userGesture?: boolean) => void;
  toggleTimer: () => void;
  stopPomodoro: () => void;
  addFiveMinutes: () => void;
  switchToPomodoroStage: (pomodoroStage: PomodoroStage) => void;
  updateDuration: (duration: number) => void;
  updateSessionDuration: (type: 'work' | 'shortBreak' | 'longBreak', duration: number) => void;
  updateSettings: (settings: Partial<PomodoroSettings>) => void;
  tick: () => void;
  handleTimerComplete: (completedSession?: CompletedSessionSnapshot) => Promise<void>;
  startTimerInterval: () => void;
  stopTimerInterval: () => void;

  reset: () => void;
};

// Timer interval stored outside the store to avoid reactivity issues
let timerIntervalId: ReturnType<typeof setInterval> | null = null;
// Completion timeout stored at module scope for HMR/test robustness
let completionTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const usePomodoroStore = create<PomodoroStore>()(
  persist(
    (set, get) => {
      function clearCompletionTimeout() {
        if (completionTimeoutId) {
          clearTimeout(completionTimeoutId);
          completionTimeoutId = null;
        }
      }

      function scheduleCompletionTimeout(endsAtMs: number) {
        clearCompletionTimeout();
        const delay = Math.max(0, endsAtMs - Date.now());
        completionTimeoutId = setTimeout(() => {
          get().tick();
        }, delay);
      }

      return {
        pomodoroStage: 'work',
        isPomodoroActive: false,
        isRunning: false,
        endsAtMs: null,
        timeLeftSec: DEFAULT_WORK_DURATION * 60,
        totalTimeSec: DEFAULT_WORK_DURATION * 60,
        sessionDurations: {
          work: DEFAULT_WORK_DURATION,
          shortBreak: DEFAULT_SHORT_BREAK_DURATION,
          longBreak: DEFAULT_LONG_BREAK_DURATION,
        },
        settings: {
          soundVolume: DEFAULT_SOUND_VOLUME,
          notificationSound: SOUND_DEFAULT_STORAGE,
        },
        isLoaded: true,

        startPomodoro: (duration, autoStart = false, userGesture = false) => {
          // Prevent overlapping timers from previous runs
          get().stopTimerInterval();
          clearCompletionTimeout();

          const state = get();
          const workDuration = duration ?? state.sessionDurations.work;
          const durationInSeconds = workDuration * 60;

          // Only actually auto-start if caller explicitly marks this as a user gesture.
          // This prevents programmatic auto-starts from relying on unlocked audio.
          const shouldAutoStart = autoStart && userGesture;

          const endsAt = shouldAutoStart ? Date.now() + durationInSeconds * 1000 : null;

          set({
            pomodoroStage: 'work',
            sessionDurations: duration ? { ...state.sessionDurations, work: duration } : state.sessionDurations,
            timeLeftSec: durationInSeconds,
            totalTimeSec: durationInSeconds,
            isPomodoroActive: true,
            isRunning: shouldAutoStart,
            endsAtMs: endsAt,
          });

          if (shouldAutoStart && endsAt) {
            get().startTimerInterval();
            scheduleCompletionTimeout(endsAt);
            get().tick(); // immediate UI sync
          }
        },

        toggleTimer: () => {
          const state = get();

          if (!state.isPomodoroActive) {
            set({ isPomodoroActive: true });
          }

          const newIsRunning = !state.isRunning;

          if (newIsRunning && typeof window !== 'undefined') {
            if (!soundManager.isReady()) {
              void soundManager.init();
            }
            void soundManager.resumeAudio();
            if ('Notification' in window && Notification.permission === 'default') {
              void Notification.requestPermission();
            }
          }

          // Use a local authoritative timeLeft for pause/start transitions to avoid stale snapshots
          let nextTimeLeftSec = state.timeLeftSec;

          // If pausing, compute an exact remaining seconds from endsAtMs to avoid ~1s drift
          if (!newIsRunning && state.endsAtMs) {
            nextTimeLeftSec = Math.max(0, Math.ceil((state.endsAtMs - Date.now()) / 1000));
          }

          if (!newIsRunning) {
            // Pause path: clear timers and update state in a single set to reduce renders
            clearCompletionTimeout();
            get().stopTimerInterval();
            set({ isRunning: false, endsAtMs: null, timeLeftSec: nextTimeLeftSec });
            return;
          }

          // Starting path: compute endsAt from the authoritative nextTimeLeftSec
          const endsAt = Date.now() + nextTimeLeftSec * 1000;
          set({ isRunning: true, endsAtMs: endsAt });

          get().startTimerInterval();
          scheduleCompletionTimeout(endsAt);
          get().tick();
        },

        stopPomodoro: () => {
          const state = get();
          get().stopTimerInterval();
          clearCompletionTimeout();

          const durationInSeconds = state.sessionDurations.work * 60;

          set({
            isRunning: false,
            isPomodoroActive: false,
            endsAtMs: null,
            pomodoroStage: 'work',
            timeLeftSec: durationInSeconds,
            totalTimeSec: durationInSeconds,
          });
        },

        addFiveMinutes: () => {
          set(state => ({
            timeLeftSec: state.timeLeftSec + 5 * 60,
            totalTimeSec: state.totalTimeSec + 5 * 60,
            endsAtMs: state.isRunning && state.endsAtMs ? state.endsAtMs + 5 * 60 * 1000 : state.endsAtMs,
          }));

          const s = get();
          if (s.isRunning && s.endsAtMs) {
            scheduleCompletionTimeout(s.endsAtMs);
          }
        },

        switchToPomodoroStage: (newPomodoroStage) => {
          const state = get();
          if (!Object.hasOwn(state.sessionDurations, newPomodoroStage)) {
            console.error('Invalid pomodoro stage:', newPomodoroStage);
            return;
          }

          get().stopTimerInterval();
          clearCompletionTimeout();

          const duration = state.sessionDurations[newPomodoroStage as keyof SessionDurations];
          const durationInSeconds = duration * 60;

          set({
            pomodoroStage: newPomodoroStage,
            timeLeftSec: durationInSeconds,
            totalTimeSec: durationInSeconds,
            isRunning: false,
            isPomodoroActive: true,
            endsAtMs: null,
          });
        },

        updateDuration: (newDuration) => {
          const state = get();
          // Prevent editing durations while a timer is running to avoid desync
          if (state.isRunning) {
            return;
          }

          const newSessionDurations = { ...state.sessionDurations, [state.pomodoroStage]: newDuration };
          set({ sessionDurations: newSessionDurations });

          const durationInSeconds = newDuration * 60;
          set({ timeLeftSec: durationInSeconds, totalTimeSec: durationInSeconds });
        },

        updateSessionDuration: (type, duration) => {
          const state = get();
          // Prevent editing durations while a timer is running to avoid desync
          if (state.isRunning) {
            return;
          }

          const newSessionDurations = { ...state.sessionDurations, [type]: duration };
          set({ sessionDurations: newSessionDurations });

          if (state.pomodoroStage === type) {
            const durationInSeconds = duration * 60;
            set({ timeLeftSec: durationInSeconds, totalTimeSec: durationInSeconds });
          }
        },

        updateSettings: (newSettings) => {
          set(state => ({ settings: { ...state.settings, ...newSettings } }));
        },

        tick: () => {
          const state = get();
          if (!state.isRunning || !state.endsAtMs) {
            return;
          }

          const remainingSec = Math.max(0, Math.ceil((state.endsAtMs - Date.now()) / 1000));
          if (remainingSec > 0) {
            if (remainingSec !== state.timeLeftSec) {
              set({ timeLeftSec: remainingSec });
            }
            return;
          }

          const completedSession: CompletedSessionSnapshot = {
            pomodoroStage: state.pomodoroStage,
            totalTimeSec: state.totalTimeSec,
          };

          set({ timeLeftSec: 0, isRunning: false, endsAtMs: null });
          get().stopTimerInterval();
          // Clear the scheduled completion timeout immediately to avoid stale timers
          clearCompletionTimeout();
          setTimeout(() => get().handleTimerComplete(completedSession), 0);
        },

        handleTimerComplete: async (completedSession) => {
          clearCompletionTimeout();
          const state = get();
          const completedStage = completedSession?.pomodoroStage ?? state.pomodoroStage;
          const completedTotalTimeSec = completedSession?.totalTimeSec ?? state.totalTimeSec;

          const sound = state.settings.notificationSound;
          const volume = Math.max(0, Math.min(1, state.settings.soundVolume / 100));

          try {
            await playSelectedNotificationSound(sound, volume);
          } catch (err) {
            console.error('Alarm failed to play:', err);
          }

          if (typeof window !== 'undefined' && document.visibilityState !== 'visible') {
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                const title = completedStage === 'work' ? 'Pomodoro complete' : 'Break finished';
                const body = completedStage === 'work' ? 'Time for a break.' : 'Back to work!';
                void new Notification(title, { body });
              } catch {
                // ignore
              }
            }
          }

          if (completedStage === 'work' && completedTotalTimeSec > 0) {
            const completedMinutes = completedTotalTimeSec / 60;
            const durationHours = completedMinutes / 60;
            const completionDescription = completedMinutes < 1
              ? `You've worked for ${completedTotalTimeSec} seconds!`
              : `You've worked for ${completedMinutes.toFixed(0)} minutes!`;
            try {
              await api.post(API_ENDPOINTS.POMODORO.COMPLETE, {
                durationHours,
              });
              toast.success('Pomodoro completed!', { description: completionDescription });
            } catch (error) {
              console.error('Failed to complete Pomodoro:', error);
              toast.error(error instanceof Error ? error.message : 'Failed to complete Pomodoro');
            }
          }

          if (completedStage === 'work' && completedTotalTimeSec > 0) {
            const workMinutes = completedTotalTimeSec / 60;
            const nextBreakType = workMinutes >= LONG_BREAK_THRESHOLD ? 'longBreak' : 'shortBreak';
            get().switchToPomodoroStage(nextBreakType);
          } else {
            get().switchToPomodoroStage('work');
          }
        },

        startTimerInterval: () => {
          if (timerIntervalId) {
            clearInterval(timerIntervalId);
          }
          timerIntervalId = setInterval(() => get().tick(), 1000);
        },

        stopTimerInterval: () => {
          if (timerIntervalId) {
            clearInterval(timerIntervalId);
            timerIntervalId = null;
          }
        },

        reset: () => {
          get().stopTimerInterval();
          clearCompletionTimeout();
          set({
            pomodoroStage: 'work',
            isPomodoroActive: false,
            isRunning: false,
            endsAtMs: null,
            timeLeftSec: DEFAULT_WORK_DURATION * 60,
            totalTimeSec: DEFAULT_WORK_DURATION * 60,
            sessionDurations: {
              work: DEFAULT_WORK_DURATION,
              shortBreak: DEFAULT_SHORT_BREAK_DURATION,
              longBreak: DEFAULT_LONG_BREAK_DURATION,
            },
          });
        },
      };
    },
    {
      name: 'pomodoro-storage',
      partialize: state => ({
        sessionDurations: state.sessionDurations,
        settings: state.settings,
      }),
    },
  ),
);

// Initialize sound manager on client side
if (typeof window !== 'undefined') {
  soundManager.init();
}
