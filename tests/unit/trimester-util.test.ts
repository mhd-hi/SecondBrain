import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getCurrentTrimesterInfoWithDeps,
  getCurrentTrimesterPositionWithDeps,
} from '../../src/lib/utils/trimester-util';
import { TRIMESTER } from '../../src/types/term';
import { restoreSystemDate, setSystemDate } from '../helpers/runtime';

type TrimesterDeps = NonNullable<Parameters<typeof getCurrentTrimesterInfoWithDeps>[0]>;

function createDeps(): TrimesterDeps {
  return {
    getCurrentOrUpcomingTerm: () => ({ trimester: TRIMESTER.WINTER, year: 2026 }),
    getDatesForTerm: () => ({
      start: new Date('2026-02-01'),
      end: new Date('2026-02-28'),
      weeks: 4,
    }),
  };
}

describe('trimester-util', () => {
  beforeEach(() => {
    setSystemDate(new Date('2026-02-14T12:00:00Z'));
  });

  afterEach(() => {
    restoreSystemDate();
  });

  it('uses term dates from `getDatesForTerm` and computes totalWeeks and weekOfTrimester', () => {
    const deps = createDeps();

    const info = getCurrentTrimesterInfoWithDeps(deps, new Date('2026-02-14T12:00:00Z'));

    expect(info.startOfTrimester.getTime()).toBe(new Date('2026-02-01').getTime());
    expect(info.endOfTrimester.getTime()).toBe(new Date('2026-02-28').getTime());
    // (28-1)=27 days -> Math.ceil(27/7) = 4
    expect(info.totalWeeks).toBe(4);
    // current 14th - start 1st = 13 days -> Math.ceil(13/7) = 2
    expect(info.weekOfTrimester).toBe(2);
  });

  it('falls back to default dates when getDatesForTerm throws', () => {
    const deps: TrimesterDeps = {
      getCurrentOrUpcomingTerm: () => ({ trimester: TRIMESTER.SUMMER, year: 2026 }),
      getDatesForTerm: () => {
        throw new Error('no data');
      },
    };

    const info = getCurrentTrimesterInfoWithDeps(deps, new Date('2026-02-14T12:00:00Z'));

    // Fallbacks are based on current year (2026): start = Aug 1, 2026; end = Jan 15, 2027
    expect(info.startOfTrimester.getTime()).toBe(new Date(2026, 7, 1).getTime());
    expect(info.endOfTrimester.getTime()).toBe(new Date(2027, 0, 15).getTime());
    // current date is before start, so weekOfTrimester should be 1
    expect(info.weekOfTrimester).toBe(1);
  });

  it('computes current trimester position as a percentage (0-100)', () => {
    // Make term start Feb 10 and end Feb 20 so current Feb 14 is 4/10 = 40%
    const deps: TrimesterDeps = {
      getCurrentOrUpcomingTerm: () => ({ trimester: TRIMESTER.WINTER, year: 2026 }),
      getDatesForTerm: () => ({
        start: new Date('2026-02-10'),
        end: new Date('2026-02-20'),
        weeks: 2,
      }),
    };

    const pos = getCurrentTrimesterPositionWithDeps(deps, new Date('2026-02-14T12:00:00Z'));

    // Allow a reasonable rounding tolerance due to timezone/time-of-day differences
    expect(pos).toBeGreaterThanOrEqual(35);
    expect(pos).toBeLessThanOrEqual(50);
  });
});
