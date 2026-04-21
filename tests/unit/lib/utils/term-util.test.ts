import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRIMESTER } from '@/types/term';
import {
  buildTerm,
  calculateWeekFromDueDate,
  convertTermCodeToLabel,
  getCurrentOrUpcomingTerm,
  getCurrentTerm,
  getDatesForTerm,
  getNextTerm,
  getPrevTerm,
  getTrimesterDatesForYear,
  isValidTermId,
  nextTerm,
  parseTermId,
  STANDARD_WEEKS_PER_TERM,
} from '../../../../src/lib/utils/term-util';
import { ensureViSetSystemTime } from '../../../helpers/time';

ensureViSetSystemTime(vi);

// Test data factory
const TRIMESTER_DATES = {
  WINTER_2025_START: new Date(2025, 0, 5),
  WINTER_2025_END: new Date(2025, 3, 27),
  SUMMER_2025_START: new Date(2025, 4, 1),
  SUMMER_2025_END: new Date(2025, 7, 15),
  AUTUMN_2025_START: new Date(2025, 8, 2),
  AUTUMN_2025_END: new Date(2025, 11, 18),
} as const;

describe('term-util', () => {
  describe('isValidTermId', () => {
    it('should validate correct term IDs', () => {
      expect(isValidTermId('20251')).toBe(true);
      expect(isValidTermId('20252')).toBe(true);
      expect(isValidTermId('20253')).toBe(true);
    });

    it('should reject invalid term IDs', () => {
      expect(isValidTermId('2025')).toBe(false);
      expect(isValidTermId('202500')).toBe(false);
      expect(isValidTermId('20254')).toBe(false);
      expect(isValidTermId('abc1')).toBe(false);
      expect(isValidTermId('202a')).toBe(false);
    });
  });

  describe('convertTermCodeToLabel', () => {
    it('should convert winter term correctly', () => {
      expect(convertTermCodeToLabel('20251')).toBe('Hiver 2025');
    });

    it('should convert summer term correctly', () => {
      expect(convertTermCodeToLabel('20252')).toBe('Été 2025');
    });

    it('should convert autumn term correctly', () => {
      expect(convertTermCodeToLabel('20253')).toBe('Automne 2025');
    });

    it('should return original code for invalid term IDs', () => {
      expect(convertTermCodeToLabel('invalid')).toBe('invalid');
      expect(convertTermCodeToLabel('2025')).toBe('2025');
    });
  });

  describe('buildTerm', () => {
    it('should build winter term correctly', () => {
      const term = buildTerm({ trimester: TRIMESTER.WINTER, year: 2025 });

      expect(term.id).toBe('20251');
      expect(term.label).toBe('Hiver 2025');
    });

    it('should build summer term correctly', () => {
      const term = buildTerm({ trimester: TRIMESTER.SUMMER, year: 2025 });

      expect(term.id).toBe('20252');
      expect(term.label).toBe('Été 2025');
    });

    it('should build autumn term correctly', () => {
      const term = buildTerm({ trimester: TRIMESTER.AUTUMN, year: 2025 });

      expect(term.id).toBe('20253');
      expect(term.label).toBe('Automne 2025');
    });

    it('should throw error for invalid trimester', () => {
      expect(() => buildTerm({ trimester: 'invalid' as unknown as typeof TRIMESTER.WINTER, year: 2025 })).toThrow();
    });
  });

  describe('parseTermId', () => {
    it('should parse winter term ID', () => {
      const { year, trimester } = parseTermId('20251');

      expect(year).toBe(2025);
      expect(trimester).toBe(TRIMESTER.WINTER);
    });

    it('should parse summer term ID', () => {
      const { year, trimester } = parseTermId('20252');

      expect(year).toBe(2025);
      expect(trimester).toBe(TRIMESTER.SUMMER);
    });

    it('should parse autumn term ID', () => {
      const { year, trimester } = parseTermId('20253');

      expect(year).toBe(2025);
      expect(trimester).toBe(TRIMESTER.AUTUMN);
    });

    it('should throw error for invalid term ID', () => {
      expect(() => parseTermId('2025')).toThrow();
      expect(() => parseTermId('invalid')).toThrow();
    });
  });

  describe('getTrimesterDatesForYear', () => {
    it('should return correct winter dates', () => {
      const dates = getTrimesterDatesForYear(2025);

      expect(dates[TRIMESTER.WINTER].start).toEqual(new Date(2025, 0, 5));
      expect(dates[TRIMESTER.WINTER].end).toEqual(new Date(2025, 3, 27));
      expect(dates[TRIMESTER.WINTER].weeks).toBe(STANDARD_WEEKS_PER_TERM);
    });

    it('should return correct summer dates', () => {
      const dates = getTrimesterDatesForYear(2025);

      expect(dates[TRIMESTER.SUMMER].start).toEqual(new Date(2025, 4, 1));
      expect(dates[TRIMESTER.SUMMER].end).toEqual(new Date(2025, 7, 15));
    });

    it('should return correct autumn dates', () => {
      const dates = getTrimesterDatesForYear(2025);

      expect(dates[TRIMESTER.AUTUMN].start).toEqual(new Date(2025, 8, 2));
      expect(dates[TRIMESTER.AUTUMN].end).toEqual(new Date(2025, 11, 18));
    });
  });

  describe('getDatesForTerm', () => {
    it('should get dates for term ID', () => {
      const dates = getDatesForTerm('20251');

      expect(dates.start).toEqual(new Date(2025, 0, 5));
      expect(dates.end).toEqual(new Date(2025, 3, 27));
    });

    it('should throw error for invalid term ID', () => {
      expect(() => getDatesForTerm('invalid')).toThrow();
    });
  });

  describe('getCurrentTerm', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return WINTER when in winter term', () => {
      // Jan 15, 2025 is in winter
      vi.setSystemTime(new Date(2025, 0, 15));

      expect(getCurrentTerm()).toBe(TRIMESTER.WINTER);
    });

    it('should return SUMMER when in summer term', () => {
      // June 1, 2025 is in summer
      vi.setSystemTime(new Date(2025, 5, 1));

      expect(getCurrentTerm()).toBe(TRIMESTER.SUMMER);
    });

    it('should return AUTUMN when in autumn term', () => {
      // Sep 15, 2025 is in autumn
      vi.setSystemTime(new Date(2025, 8, 15));

      expect(getCurrentTerm()).toBe(TRIMESTER.AUTUMN);
    });

    it('should return null when between terms', () => {
      // Dec 25, 2025 is after autumn ends
      vi.setSystemTime(new Date(2025, 11, 25));

      expect(getCurrentTerm()).toBeNull();
    });
  });

  describe('getNextTerm', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return WINTER before winter starts', () => {
      // Jan 1, 2025
      vi.setSystemTime(new Date(2025, 0, 1));

      expect(getNextTerm()).toBe(TRIMESTER.WINTER);
    });

    it('should return SUMMER before summer starts', () => {
      // Apr 30, 2025
      vi.setSystemTime(new Date(2025, 3, 30));

      expect(getNextTerm()).toBe(TRIMESTER.SUMMER);
    });

    it('should return AUTUMN before autumn starts', () => {
      // Aug 20, 2025
      vi.setSystemTime(new Date(2025, 7, 20));

      expect(getNextTerm()).toBe(TRIMESTER.AUTUMN);
    });

    it('should return WINTER after autumn ends', () => {
      // Dec 25, 2025
      vi.setSystemTime(new Date(2025, 11, 25));

      expect(getNextTerm()).toBe(TRIMESTER.WINTER);
    });
  });

  describe('getCurrentOrUpcomingTerm', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return current term if in one', () => {
      // Jan 15, 2025
      vi.setSystemTime(new Date(2025, 0, 15));

      const result = getCurrentOrUpcomingTerm();

      expect(result.trimester).toBe(TRIMESTER.WINTER);
      expect(result.year).toBe(2025);
    });

    it('should return next term with correct year when between terms before winter', () => {
      // Jan 1, 2025
      vi.setSystemTime(new Date(2025, 0, 1));

      const result = getCurrentOrUpcomingTerm();

      expect(result.trimester).toBe(TRIMESTER.WINTER);
      expect(result.year).toBe(2025);
    });

    it('should return next year winter when after autumn ends', () => {
      // Dec 25, 2025
      vi.setSystemTime(new Date(2025, 11, 25));

      const result = getCurrentOrUpcomingTerm();

      expect(result.trimester).toBe(TRIMESTER.WINTER);
      expect(result.year).toBe(2026);
    });
  });

  describe('getPrevTerm', () => {
    it('should get previous term for winter', () => {
      const result = getPrevTerm(TRIMESTER.WINTER, 2025);

      expect(result.trimester).toBe(TRIMESTER.AUTUMN);
      expect(result.year).toBe(2024);
    });

    it('should get previous term for summer', () => {
      const result = getPrevTerm(TRIMESTER.SUMMER, 2025);

      expect(result.trimester).toBe(TRIMESTER.WINTER);
      expect(result.year).toBe(2025);
    });

    it('should get previous term for autumn', () => {
      const result = getPrevTerm(TRIMESTER.AUTUMN, 2025);

      expect(result.trimester).toBe(TRIMESTER.SUMMER);
      expect(result.year).toBe(2025);
    });
  });

  describe('nextTerm', () => {
    it('should get next term for winter', () => {
      const result = nextTerm(TRIMESTER.WINTER, 2025);

      expect(result.trimester).toBe(TRIMESTER.SUMMER);
      expect(result.year).toBe(2025);
    });

    it('should get next term for summer', () => {
      const result = nextTerm(TRIMESTER.SUMMER, 2025);

      expect(result.trimester).toBe(TRIMESTER.AUTUMN);
      expect(result.year).toBe(2025);
    });

    it('should get next term for autumn', () => {
      const result = nextTerm(TRIMESTER.AUTUMN, 2025);

      expect(result.trimester).toBe(TRIMESTER.WINTER);
      expect(result.year).toBe(2026);
    });
  });

  describe('calculateWeekFromDueDate', () => {
    it('should calculate correct week for date in term', () => {
      // Jan 12, 2025 is 7 days after winter start (Jan 5), which is week 1
      const dueDate = new Date(2025, 0, 12);

      const week = calculateWeekFromDueDate(dueDate);

      expect(week).toBe(1);
    });

    it('should calculate week 1 for date on term start', () => {
      const dueDate = new Date(2025, 0, 5);

      const week = calculateWeekFromDueDate(dueDate);

      expect(week).toBe(1);
    });

    it('should handle custom course weeks', () => {
      // Jan 12, 2025 in a 26-week course
      const dueDate = new Date(2025, 0, 12);

      const week = calculateWeekFromDueDate(dueDate, 26);

      expect(week).toBeGreaterThan(1);
    });

    it('should return at least week 1 for dates before term start', () => {
      const dueDate = new Date(2025, 0, 1);

      const week = calculateWeekFromDueDate(dueDate);

      expect(week).toBe(1);
    });

    it('should calculate mid-term week for date in middle of term', () => {
      // Jan 26, 2025 is 21 days (3 weeks) after winter start (Jan 5)
      const dueDate = new Date(2025, 0, 26);

      const week = calculateWeekFromDueDate(dueDate);

      expect(week).toBe(3);
    });

    it('should calculate late-term week for date near end of term', () => {
      // Apr 20, 2025 is near the end of winter (Apr 27)
      const dueDate = new Date(2025, 3, 20);

      const week = calculateWeekFromDueDate(dueDate);

      expect(week).toBe(13);
    });

    it('should handle date on term end', () => {
      // Apr 27, 2025 is the last day of winter
      const dueDate = new Date(2025, 3, 27);

      const week = calculateWeekFromDueDate(dueDate);

      expect(week).toBe(13);
    });

    it('should handle date between autumn and winter (Dec 19, 2025)', () => {
      // Dec 19, 2025 is between Autumn end (Dec 18) and Winter start (Jan 5, 2026)
      // The function falls back to winter of the same year before checking next year
      const dueDate = new Date(2025, 11, 19);

      const week = calculateWeekFromDueDate(dueDate);

      // Since Dec 19 is after all 2025 terms end, it falls back to Autumn as the last term of 2025
      expect(week).toBe(13);
    });

    it('should handle date between autumn and winter (Dec 18, 2025)', () => {
      // Dec 18, 2025 is the last day of Autumn 2025
      const dueDate = new Date(2025, 11, 18);

      const week = calculateWeekFromDueDate(dueDate);

      expect(week).toBe(13);
    });

    it('should handle date between winter and summer (Apr 28, 2025)', () => {
      // Apr 28, 2025 is between Winter end (Apr 27) and Summer start (May 4)
      const dueDate = new Date(2025, 3, 28);

      const week = calculateWeekFromDueDate(dueDate);

      // Should default to next upcoming term (Summer 2025) week 1
      expect(week).toBe(1);
    });

    it('should handle date between summer and autumn (Aug 16, 2025)', () => {
      // Aug 16, 2025 is between Summer end (Aug 15) and Autumn start (Sep 2)
      const dueDate = new Date(2025, 7, 16);

      const week = calculateWeekFromDueDate(dueDate);

      // Should default to next upcoming term (Autumn 2025) week 1
      expect(week).toBe(1);
    });

    it('should handle summer term dates', () => {
      // May 11, 2025 is one week after summer start (May 4)
      const dueDate = new Date(2025, 4, 11);

      const week = calculateWeekFromDueDate(dueDate);

      expect(week).toBe(1);
    });

    it('should handle autumn term dates', () => {
      // Sep 9, 2025 is one week after autumn start (Sep 2)
      const dueDate = new Date(2025, 8, 9);

      const week = calculateWeekFromDueDate(dueDate);

      expect(week).toBe(1);
    });

    it('should handle date far in the future', () => {
      // Dec 1, 2026 (future year)
      const dueDate = new Date(2026, 11, 1);

      const week = calculateWeekFromDueDate(dueDate);

      // Should map to appropriate term in that year
      expect(week).toBeGreaterThanOrEqual(1);
      expect(week).toBeLessThanOrEqual(13);
    });
  });

  describe('STANDARD_WEEKS_PER_TERM', () => {
    it('should be 13 weeks', () => {
      expect(STANDARD_WEEKS_PER_TERM).toBe(13);
    });
  });

  describe('calculateWeekFromDueDate - boundary seconds', () => {
    it('should handle term start at 00:00:00', () => {
      const dueDate = new Date(2025, 0, 5, 0, 0, 0);

      const week = calculateWeekFromDueDate(dueDate);

      expect(week).toBe(1);
    });

    it('should handle date just before term end', () => {
      // Apr 26, 2025 at 23:59:59 is still within the term
      const dueDate = new Date(2025, 3, 26, 23, 59, 59);

      const week = calculateWeekFromDueDate(dueDate);

      expect(week).toBe(13);
    });
  });

  describe('calculateWeekFromDueDate - variable course weeks', () => {
    it('should scale weeks correctly for different course lengths', () => {
      const dueDate = new Date(2025, 0, 12); // Week 1 of term

      expect(calculateWeekFromDueDate(dueDate, 13)).toBe(1);
      expect(calculateWeekFromDueDate(dueDate, 26)).toBeGreaterThan(1);
      expect(calculateWeekFromDueDate(dueDate, 4)).toBeGreaterThanOrEqual(1);
    });

    it('should not exceed total course weeks', () => {
      // Near end of term
      const dueDate = new Date(2025, 3, 25);

      expect(calculateWeekFromDueDate(dueDate, 10)).toBeLessThanOrEqual(10);
      expect(calculateWeekFromDueDate(dueDate, 20)).toBeLessThanOrEqual(20);
    });
  });

  describe('buildTerm - structure validation', () => {
    it('should build term with correct structure', () => {
      const term = buildTerm({ trimester: TRIMESTER.WINTER, year: 2025 });

      expect(term).toMatchObject({
        id: '20251',
        label: 'Hiver 2025',
      });
    });

    it('should build all term types with consistent structure', () => {
      const winterTerm = buildTerm({ trimester: TRIMESTER.WINTER, year: 2025 });
      const summerTerm = buildTerm({ trimester: TRIMESTER.SUMMER, year: 2025 });
      const autumnTerm = buildTerm({ trimester: TRIMESTER.AUTUMN, year: 2025 });

      [winterTerm, summerTerm, autumnTerm].forEach((term) => {
        expect(term).toHaveProperty('id');
        expect(term).toHaveProperty('label');
        expect(term.id).toMatch(/^\d{5}$/);
        expect(term.label).toMatch(/\d{4}$/); // Year at end
      });
    });
  });

  describe('getNextTerm vs getCurrentOrUpcomingTerm', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should differ when in a term', () => {
      // Jan 15, 2025 is in winter
      vi.setSystemTime(new Date(2025, 0, 15));

      expect(getCurrentTerm()).toBe(TRIMESTER.WINTER);
      expect(getNextTerm()).toBe(TRIMESTER.SUMMER);

      const upcoming = getCurrentOrUpcomingTerm();

      expect(upcoming.trimester).toBe(TRIMESTER.WINTER);
      expect(upcoming.year).toBe(2025);
    });

    it('should be same when between terms', () => {
      // Dec 25, 2025 is between terms
      vi.setSystemTime(new Date(2025, 11, 25));

      expect(getCurrentTerm()).toBeNull();
      expect(getNextTerm()).toBe(TRIMESTER.WINTER);

      const upcoming = getCurrentOrUpcomingTerm();

      expect(upcoming.trimester).toBe(TRIMESTER.WINTER);
      expect(upcoming.year).toBe(2026);
    });
  });

  describe('getTrimesterDatesForYear - consistency', () => {
    it('should return dates matching test data factory', () => {
      const dates = getTrimesterDatesForYear(2025);

      expect(dates[TRIMESTER.WINTER].start).toEqual(TRIMESTER_DATES.WINTER_2025_START);
      expect(dates[TRIMESTER.WINTER].end).toEqual(TRIMESTER_DATES.WINTER_2025_END);
      expect(dates[TRIMESTER.SUMMER].start).toEqual(TRIMESTER_DATES.SUMMER_2025_START);
      expect(dates[TRIMESTER.SUMMER].end).toEqual(TRIMESTER_DATES.SUMMER_2025_END);
      expect(dates[TRIMESTER.AUTUMN].start).toEqual(TRIMESTER_DATES.AUTUMN_2025_START);
      expect(dates[TRIMESTER.AUTUMN].end).toEqual(TRIMESTER_DATES.AUTUMN_2025_END);
    });

    it('should have consistent weeks across all trimesters', () => {
      const dates = getTrimesterDatesForYear(2025);

      expect(dates[TRIMESTER.WINTER].weeks).toBe(STANDARD_WEEKS_PER_TERM);
      expect(dates[TRIMESTER.SUMMER].weeks).toBe(STANDARD_WEEKS_PER_TERM);
      expect(dates[TRIMESTER.AUTUMN].weeks).toBe(STANDARD_WEEKS_PER_TERM);
    });
  });
});
