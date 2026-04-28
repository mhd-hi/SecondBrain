import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildTerm,
  calculateWeekFromDueDate,
  getCurrentOrUpcomingTerm,
  getCurrentTerm,
  getDatesForTerm,
  parseTermId,
} from '@/lib/utils/term-util';

import { TRIMESTER } from '@/types/term';
import { ensureViSetSystemTime } from '../helpers/time';

ensureViSetSystemTime(vi);

describe('term workflow', () => {
  describe('complete term workflow', () => {
    it('handles a full term parse and build cycle', () => {
      const termId = '20251';
      const { year, trimester } = parseTermId(termId);

      expect(year).toBe(2025);
      expect(trimester).toBe(TRIMESTER.WINTER);

      const term = buildTerm({ trimester, year });

      expect(term.id).toBe(termId);
      expect(term.label).toBe('Hiver 2025');

      const dates = getDatesForTerm(termId);

      expect(dates.start).toEqual(new Date(2025, 0, 5));
      expect(dates.end).toEqual(new Date(2025, 3, 27));
      expect(dates.start.getTime()).toBeLessThan(dates.end.getTime());
    });

    it('handles all three terms in sequence', () => {
      const termIds = ['20251', '20252', '20253'];
      const expectedTrimesters = [TRIMESTER.WINTER, TRIMESTER.SUMMER, TRIMESTER.AUTUMN];
      const expectedLabels = ['Hiver 2025', 'Été 2025', 'Automne 2025'];

      termIds.forEach((termId, index) => {
        const { trimester } = parseTermId(termId);
        const term = buildTerm({ trimester, year: 2025 });
        const dates = getDatesForTerm(termId);

        expect(trimester).toBe(expectedTrimesters[index]);
        expect(term.label).toBe(expectedLabels[index]);
        expect(dates.start.getTime()).toBeLessThan(dates.end.getTime());
      });
    });
  });

  describe('date navigation workflow', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('navigates through terms chronologically', () => {
      vi.setSystemTime(new Date(2025, 0, 1));

      let current = getCurrentOrUpcomingTerm();

      expect(current.trimester).toBe(TRIMESTER.WINTER);
      expect(current.year).toBe(2025);

      vi.setSystemTime(new Date(2025, 4, 1));
      current = getCurrentOrUpcomingTerm();

      expect(current.trimester).toBe(TRIMESTER.SUMMER);
      expect(current.year).toBe(2025);

      vi.setSystemTime(new Date(2025, 8, 1));
      current = getCurrentOrUpcomingTerm();

      expect(current.trimester).toBe(TRIMESTER.AUTUMN);
      expect(current.year).toBe(2025);

      vi.setSystemTime(new Date(2025, 11, 25));
      current = getCurrentOrUpcomingTerm();

      expect(current.trimester).toBe(TRIMESTER.WINTER);
      expect(current.year).toBe(2026);
    });

    it('identifies term transitions correctly', () => {
      const transitions = [
        { date: new Date(2025, 3, 27), expectedTrimester: TRIMESTER.WINTER },
        { date: new Date(2025, 3, 28), expectedTrimester: TRIMESTER.SUMMER },
        { date: new Date(2025, 7, 15), expectedTrimester: TRIMESTER.SUMMER },
        { date: new Date(2025, 7, 16), expectedTrimester: TRIMESTER.AUTUMN },
        { date: new Date(2025, 11, 18), expectedTrimester: TRIMESTER.AUTUMN },
        { date: new Date(2025, 11, 19), expectedTrimester: TRIMESTER.WINTER },
      ];

      transitions.forEach(({ date, expectedTrimester }) => {
        vi.setSystemTime(date);

        const current = getCurrentOrUpcomingTerm();

        expect(current.trimester).toBe(expectedTrimester);
      });
    });
  });

  describe('week calculation within term context', () => {
    it('calculates weeks correctly across term boundaries', () => {
      const earlyWeek = calculateWeekFromDueDate(new Date(2025, 0, 12));
      const midWeek = calculateWeekFromDueDate(new Date(2025, 1, 23));
      const lateWeek = calculateWeekFromDueDate(new Date(2025, 3, 20));

      expect(earlyWeek).toBe(1);
      expect(midWeek).toBeGreaterThan(earlyWeek);
      expect(midWeek).toBeLessThan(13);
      expect(lateWeek).toBeGreaterThan(midWeek);
      expect(lateWeek).toBe(13);
    });

    it('handles between-term dates appropriately', () => {
      expect(calculateWeekFromDueDate(new Date(2025, 3, 28))).toBe(1);
      expect(calculateWeekFromDueDate(new Date(2025, 7, 16))).toBe(1);
      expect(calculateWeekFromDueDate(new Date(2025, 11, 19))).toBe(13);
    });
  });

  describe('multi-term coordination', () => {
    it('identifies all terms for a given year', () => {
      const termIds = ['20251', '20252', '20253'];
      const builtTerms = termIds.map((id) => {
        const { year, trimester } = parseTermId(id);

        return buildTerm({ trimester, year });
      });

      expect(builtTerms).toHaveLength(3);
      expect(builtTerms[0]?.label).toContain('Hiver');
      expect(builtTerms[1]?.label).toContain('Été');
      expect(builtTerms[2]?.label).toContain('Automne');
      expect(builtTerms.every(term => term.label.includes('2025'))).toBe(true);
    });

    it('maintains consistency across year boundaries', () => {
      const autumn2025Id = '20253';
      const { year: autumnYear, trimester: autumnTrimester } = parseTermId(autumn2025Id);
      const autumn2025 = buildTerm({ trimester: autumnTrimester, year: autumnYear });

      expect(autumn2025.label).toBe('Automne 2025');

      const winter2026Id = '20261';
      const { year: winterYear, trimester: winterTrimester } = parseTermId(winter2026Id);
      const winter2026 = buildTerm({ trimester: winterTrimester, year: winterYear });

      expect(winter2026.label).toBe('Hiver 2026');
      expect(winterYear).toBe(autumnYear + 1);
    });
  });

  describe('real-world scenarios', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('handles checking the current term between sessions', () => {
      vi.setSystemTime(new Date(2025, 11, 19));

      const currentTerm = getCurrentTerm();
      const upcomingTerm = getCurrentOrUpcomingTerm();

      expect(currentTerm).toBeNull();
      expect(upcomingTerm.trimester).toBe(TRIMESTER.WINTER);
      expect(upcomingTerm.year).toBe(2026);
      expect(buildTerm(upcomingTerm).label).toBe('Hiver 2026');
    });

    it('handles assignment due date calculation mid-semester', () => {
      vi.setSystemTime(new Date(2025, 1, 15));

      const dueDate = new Date(2025, 2, 1);
      const currentTerm = getCurrentTerm();
      const weekOfAssignment = calculateWeekFromDueDate(dueDate);

      expect(currentTerm).toBe(TRIMESTER.WINTER);
      expect(weekOfAssignment).toBeGreaterThan(1);
      expect(weekOfAssignment).toBeLessThanOrEqual(13);
    });
  });
});
