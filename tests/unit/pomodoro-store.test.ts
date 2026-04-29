import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureHappyDom } from '../helpers/runtime';

const postMock = vi.fn();
const getMock = vi.fn();
const playSelectedNotificationSoundMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('@/lib/sound-manager', () => ({
  SOUND_DEFAULT_STORAGE: 'default',
  soundManager: {
    init: vi.fn(),
    isReady: vi.fn(() => true),
    resumeAudio: vi.fn(),
  },
}));

vi.mock('@/lib/utils/audio-util', () => ({
  playSelectedNotificationSound: playSelectedNotificationSoundMock,
}));

vi.mock('@/lib/utils/api/api-client-util', () => ({
  api: {
    post: postMock,
    get: getMock,
  },
}));

const { API_ENDPOINTS } = await import('@/lib/utils/api/endpoints');
const { usePomodoroStore } = await import('@/lib/stores/pomodoro-store');

describe('pomodoro store completion handling', () => {
  beforeEach(() => {
    ensureHappyDom();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T16:00:00.000Z'));
    postMock.mockResolvedValue({ streakDays: 4 });
    getMock.mockResolvedValue({ streakDays: 0 });
    playSelectedNotificationSoundMock.mockResolvedValue(undefined);
    vi.clearAllMocks();
    usePomodoroStore.getState().reset();
  });

  afterEach(() => {
    usePomodoroStore.getState().reset();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('posts completed work minutes even if the stage changes before the deferred completion handler runs', async () => {
    usePomodoroStore.setState({
      pomodoroStage: 'work',
      isPomodoroActive: true,
      isRunning: true,
      endsAtMs: Date.now() - 1000,
      timeLeftSec: 1,
      totalTimeSec: 25 * 60,
    });

    usePomodoroStore.getState().tick();
    usePomodoroStore.getState().switchToPomodoroStage('shortBreak');

    await vi.runAllTimersAsync();

    expect(postMock).toHaveBeenCalledWith(API_ENDPOINTS.POMODORO.COMPLETE, {
      durationHours: 25 / 60,
    });
    expect(usePomodoroStore.getState().streak).toBe(4);
  });
});
