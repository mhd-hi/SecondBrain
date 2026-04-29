// Predefined duration options - includes classic and alternative Pomodoro variants
export const POMODORO_DURATION_OPTIONS = [
  { label: '00:03', value: 0.05 },
  { label: '15:00', value: 15 }, // Short focused session
  { label: '20:00', value: 20 }, // Alternative short session
  { label: '25:00', value: 25 }, // Classic Pomodoro
  { label: '30:00', value: 30 }, // Extended focus
  { label: '45:00', value: 45 }, // Deep work session
  { label: '52:00', value: 52 }, // 52/17 variant (popular alternative)
  { label: '60:00', value: 60 }, // Full hour session
  { label: '90:00', value: 90 }, // Ultradian rhythm session
];

export const formatTime = (minutes: number) => {
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const POMODORO_HISTORY_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const POMODORO_HISTORY_DAY_LABEL_ROWS = new Set([1, 3, 5]);

export const POMODORO_HISTORY_LEVEL_STYLES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-[#ebe5ff] dark:bg-[#312847]',
  1: 'bg-[#d8c8ff] dark:bg-[#4a3270]',
  2: 'bg-[#b99af7] dark:bg-[#6742a3]',
  3: 'bg-[#915ee8] dark:bg-[#8b5cf6]',
  4: 'bg-[#6425d0] dark:bg-[#c084fc]',
};

export function formatPomodoroHistoryMinutes(totalMinutes: number) {
  if (totalMinutes >= 60) {
    const hours = totalMinutes / 60;
    return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)}h`;
  }

  return `${Math.round(totalMinutes)}m`;
}
