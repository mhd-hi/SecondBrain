import { getCurrentOrUpcomingTerm, getDatesForTerm } from '@/lib/utils/term-util';
import { TRIMESTER } from '@/types/term';

type TrimesterInfo = {
  startOfTrimester: Date;
  endOfTrimester: Date;
  totalWeeks: number;
  weekOfTrimester: number;
};

type TrimesterTermDeps = {
  getCurrentOrUpcomingTerm: typeof getCurrentOrUpcomingTerm;
  getDatesForTerm: typeof getDatesForTerm;
};

const defaultTrimesterTermDeps: TrimesterTermDeps = {
  getCurrentOrUpcomingTerm,
  getDatesForTerm,
};

/**
 * Calculate current trimester information including dates and week position
 */
export function getCurrentTrimesterInfoWithDeps(
  deps: TrimesterTermDeps = defaultTrimesterTermDeps,
  currentDate = new Date(),
): TrimesterInfo {
  // Use getCurrentOrUpcomingTerm to handle between-term periods correctly
  const { trimester, year } = deps.getCurrentOrUpcomingTerm();
  const termDigit = trimester === TRIMESTER.WINTER
    ? '1'
    : trimester === TRIMESTER.SUMMER
      ? '2'
      : '3';
  const termId = `${year}${termDigit}`;

  let startOfTrimester = new Date(currentDate.getFullYear(), 7, 1);
  let endOfTrimester = new Date(currentDate.getFullYear() + 1, 0, 15);

  try {
    const dates = deps.getDatesForTerm(termId);
    startOfTrimester = dates.start;
    endOfTrimester = dates.end;
  } catch {
    // Keep fallback dates if term calculation fails
  }

  const totalWeeks = Math.ceil((endOfTrimester.getTime() - startOfTrimester.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const weekOfTrimester = Math.max(1, Math.ceil((currentDate.getTime() - startOfTrimester.getTime()) / (7 * 24 * 60 * 60 * 1000)));

  return {
    startOfTrimester,
    endOfTrimester,
    totalWeeks,
    weekOfTrimester,
  };
}

export function getCurrentTrimesterInfo(): TrimesterInfo {
  return getCurrentTrimesterInfoWithDeps();
}

/**
 * Calculate current position as percentage within the trimester (0-100)
 */
export function getCurrentTrimesterPositionWithDeps(
  deps: TrimesterTermDeps = defaultTrimesterTermDeps,
  currentDate = new Date(),
): number {
  const { startOfTrimester, endOfTrimester } = getCurrentTrimesterInfoWithDeps(deps, currentDate);

  const totalDuration = endOfTrimester.getTime() - startOfTrimester.getTime();
  const currentProgress = currentDate.getTime() - startOfTrimester.getTime();

  return Math.max(0, Math.min(100, (currentProgress / totalDuration) * 100));
}

export function getCurrentTrimesterPosition(): number {
  return getCurrentTrimesterPositionWithDeps();
}
