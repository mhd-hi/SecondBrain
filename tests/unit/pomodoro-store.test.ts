import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureHappyDom, restoreSystemDate, setSystemDate } from '../helpers/runtime';

const playSelectedNotificationSoundMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const originalFetch = globalThis.fetch;

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

const { API_ENDPOINTS } = await import('@/lib/utils/api/endpoints');
const { usePomodoroStore } = await import('@/lib/stores/pomodoro-store');

function setFetchMock(fetchMock: typeof fetch) {
  Object.defineProperty(globalThis, 'fetch', {
    value: fetchMock,
    configurable: true,
    writable: true,
  });
}

describe('pomodoro store completion handling', () => {
  beforeEach(() => {
    ensureHappyDom();
    vi.useFakeTimers();
    setSystemDate(new Date('2026-04-28T16:00:00.000Z'));
    setFetchMock(vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as Response) as unknown as typeof fetch);
    playSelectedNotificationSoundMock.mockResolvedValue(undefined);
    vi.clearAllMocks();
    usePomodoroStore.getState().reset();
  });

  afterEach(() => {
    usePomodoroStore.getState().reset();
    setFetchMock(originalFetch);
    restoreSystemDate();
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

    vi.runAllTimers();
    await Promise.resolve();
    await Promise.resolve();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      API_ENDPOINTS.POMODORO.COMPLETE,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationHours: 25 / 60,
        }),
      }),
    );
  });
});
