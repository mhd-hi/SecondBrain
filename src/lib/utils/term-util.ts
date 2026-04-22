import type { Term, TermBuildInput, TrimesterDates, TrimesterKey } from '@/types/term';
import { TRIMESTER, TRIMESTER_DIGIT } from '@/types/term';

// Canonical term helpers used across the app.
export const STANDARD_WEEKS_PER_TERM = 13;

// Term ID validation regex - expects format YYYY[1-3]
const TERM_ID_REGEX = /^\d{4}[1-3]$/;

// Expected format YYYY[1-3]
export const isValidTermId = (termId: string): boolean => {
    return TERM_ID_REGEX.test(termId);
};

export const getNormalizedValidTermId = (termId: string): string | null => {
    const normalizedTermId = termId.replace(/^0+/, '');
    return isValidTermId(normalizedTermId) ? normalizedTermId : null;
};

// convert PlanETS numeric term code (e.g. '20252') to a localized label
export const convertTermCodeToLabel = (code: string) => {
    // Expect format YYYY[1-3]
    if (!isValidTermId(code)) {
        return code;
    }

    const year = code.slice(0, 4);
    const digit = code.charAt(4);
    const seasonMap = new Map([
        ['1', 'Hiver'],
        ['2', 'Été'],
        ['3', 'Automne'],
    ]);
    const season = seasonMap.get(digit) ?? '';
    return `${season} ${year}`.trim();
};

export const buildTerm = (term: TermBuildInput): Term => {
    // Validate trimester: ensure a digit mapping exists for the given trimester
    if (!(term.trimester in TRIMESTER_DIGIT)) {
        throw new Error(`Unknown term key: ${term.trimester}`);
    }

    let digit: string;
    switch (term.trimester) {
        case TRIMESTER.WINTER:
            digit = TRIMESTER_DIGIT[TRIMESTER.WINTER];
            break;
        case TRIMESTER.SUMMER:
            digit = TRIMESTER_DIGIT[TRIMESTER.SUMMER];
            break;
        case TRIMESTER.AUTUMN:
            digit = TRIMESTER_DIGIT[TRIMESTER.AUTUMN];
            break;
        default:
            throw new Error(`Invalid trimester: ${term.trimester}`);
    }

    const id = `${term.year}${digit}`;
    return { id, label: convertTermCodeToLabel(id) };
};

// Resolve the concrete date window for a given term id like '20252'
export function getDatesForTerm(termId: string): { start: Date; end: Date; weeks: number } {
    const { year, trimester } = parseTermId(termId);
    const dates = getTrimesterDatesForYear(year)[trimester];
    return dates;
}

// Parse a PlanETS term id like '20252' into year and trimester
export function parseTermId(termId: string): { year: number; trimester: TrimesterKey } {
    if (!isValidTermId(termId)) {
        throw new Error(`Invalid term id: ${termId}`);
    }
    const year = Number(termId.slice(0, 4));
    const digit = termId.charAt(4);
    // Map digit -> trimester key
    const digitToTrimester: Record<'1' | '2' | '3', TrimesterKey> = {
        1: TRIMESTER.WINTER,
        2: TRIMESTER.SUMMER,
        3: TRIMESTER.AUTUMN,
    };
    const trimester = digitToTrimester[digit as '1' | '2' | '3'];
    if (!trimester) {
        throw new Error(`Unknown trimester digit in term id: ${termId}`);
    }
    return { year, trimester };
}

// Get trimester dates for a specific year (same canonical day ranges as current TRIMESTER_DATES)
export function getTrimesterDatesForYear(year: number): TrimesterDates {
    return {
        [TRIMESTER.WINTER]: {
            start: new Date(year, 0, 5), // Jan 5
            end: new Date(year, 3, 27), // Apr 27
            weeks: STANDARD_WEEKS_PER_TERM,
        },
        [TRIMESTER.SUMMER]: {
            start: new Date(year, 4, 1), // May 1
            end: new Date(year, 7, 15), // Aug 15
            weeks: STANDARD_WEEKS_PER_TERM,
        },
        [TRIMESTER.AUTUMN]: {
            start: new Date(year, 8, 2), // Sep 2
            end: new Date(year, 11, 18), // Dec 18
            weeks: STANDARD_WEEKS_PER_TERM,
        },
    };
}

// Resolve the concrete date window for a given term id like '20252'
// (moved above) getDatesForTerm()

export function getCurrentTerm(): TrimesterKey | null {
    const now = new Date();

    // Check each trimester explicitly to avoid object injection
    const yearDates = getTrimesterDatesForYear(now.getFullYear());
    const winterDates = yearDates[TRIMESTER.WINTER];
    if (winterDates && now >= winterDates.start && now <= winterDates.end) {
        return TRIMESTER.WINTER;
    }

    const summerDates = yearDates[TRIMESTER.SUMMER];
    if (summerDates && now >= summerDates.start && now <= summerDates.end) {
        return TRIMESTER.SUMMER;
    }

    const autumnDates = yearDates[TRIMESTER.AUTUMN];
    if (autumnDates && now >= autumnDates.start && now <= autumnDates.end) {
        return TRIMESTER.AUTUMN;
    }

    return null;
}

export function getNextTerm(): TrimesterKey {
    const now = new Date();

    const yearDates = getTrimesterDatesForYear(now.getFullYear());
    const winterDates = yearDates[TRIMESTER.WINTER];
    const summerDates = yearDates[TRIMESTER.SUMMER];
    const autumnDates = yearDates[TRIMESTER.AUTUMN];

    if (winterDates && now < winterDates.start) {
        return TRIMESTER.WINTER;
    } else if (summerDates && now < summerDates.start) {
        return TRIMESTER.SUMMER;
    } else if (autumnDates && now < autumnDates.start) {
        return TRIMESTER.AUTUMN;
    } else {
        return TRIMESTER.WINTER;
    }
}

/**
 * Get the current term if we're in one, otherwise return the next upcoming term
 * Returns both the trimester and the correct year
 */
export function getCurrentOrUpcomingTerm(): { trimester: TrimesterKey; year: number } {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentTerm = getCurrentTerm();

    if (currentTerm) {
        return { trimester: currentTerm, year: currentYear };
    }

    // We're between terms, find which year the next term belongs to
    const yearDates = getTrimesterDatesForYear(currentYear);
    const winterDates = yearDates[TRIMESTER.WINTER];
    const summerDates = yearDates[TRIMESTER.SUMMER];
    const autumnDates = yearDates[TRIMESTER.AUTUMN];

    if (winterDates && now < winterDates.start) {
        return { trimester: TRIMESTER.WINTER, year: currentYear };
    } else if (summerDates && now < summerDates.start) {
        return { trimester: TRIMESTER.SUMMER, year: currentYear };
    } else if (autumnDates && now < autumnDates.start) {
        return { trimester: TRIMESTER.AUTUMN, year: currentYear };
    } else {
        // After autumn ends, next term is next year's winter
        return { trimester: TRIMESTER.WINTER, year: currentYear + 1 };
    }
}

export const getPrevTerm = (trimester: TrimesterKey, year: number) => {
    if (trimester === TRIMESTER.WINTER) {
        return { trimester: TRIMESTER.AUTUMN, year: year - 1 };
    }

    if (trimester === TRIMESTER.SUMMER) {
        return { trimester: TRIMESTER.WINTER, year };
    }

    // autumn
    return { trimester: TRIMESTER.SUMMER, year };
};

export const nextTerm = (trimester: TrimesterKey, year: number) => {
    if (trimester === TRIMESTER.AUTUMN) {
        return { trimester: TRIMESTER.WINTER, year: year + 1 };
    }

    if (trimester === TRIMESTER.WINTER) {
        return { trimester: TRIMESTER.SUMMER, year };
    }

    // summer
    return { trimester: TRIMESTER.AUTUMN, year };
};

export function calculateWeekFromDueDate(dueDate: Date, totalCourseWeeks = STANDARD_WEEKS_PER_TERM): number {
    // Determine which term the due date falls into, using the due date's year ranges
    let trimester: TrimesterKey;
    let termDates: { start: Date; end: Date; weeks: number };

    const yearDates = getTrimesterDatesForYear(dueDate.getFullYear());
    const winterDates = yearDates[TRIMESTER.WINTER];
    const summerDates = yearDates[TRIMESTER.SUMMER];
    const autumnDates = yearDates[TRIMESTER.AUTUMN];

    if (winterDates && dueDate >= winterDates.start && dueDate <= winterDates.end) {
        trimester = TRIMESTER.WINTER;
        termDates = winterDates;
    } else if (summerDates && dueDate >= summerDates.start && dueDate <= summerDates.end) {
        trimester = TRIMESTER.SUMMER;
        termDates = summerDates;
    } else if (autumnDates && dueDate >= autumnDates.start && dueDate <= autumnDates.end) {
        trimester = TRIMESTER.AUTUMN;
        termDates = autumnDates;
    } else {
        // If the date doesn't fall in any term, choose the next upcoming term in that year
        if (winterDates && dueDate < winterDates.start) {
            trimester = TRIMESTER.WINTER;
            termDates = winterDates;
        } else if (summerDates && dueDate < summerDates.start) {
            trimester = TRIMESTER.SUMMER;
            termDates = summerDates;
        } else if (autumnDates && dueDate < autumnDates.start) {
            trimester = TRIMESTER.AUTUMN;
            termDates = autumnDates;
        } else {
            // Otherwise fallback to winter of the same year
            trimester = TRIMESTER.WINTER;
            termDates = winterDates!;
        }
    }

    if (!termDates) {
        throw new Error(`Unable to find dates for trimester: ${trimester}`);
    }

    // Calculate the number of days from term start to due date
    const daysDiff = Math.max(0, Math.floor((dueDate.getTime() - termDates.start.getTime()) / (1000 * 60 * 60 * 24)));

    // Convert days to weeks within the term
    const weeksFromStart = daysDiff / 7;

    // Convert from term weeks back to course weeks
    const adjustedWeek = (weeksFromStart / STANDARD_WEEKS_PER_TERM) * totalCourseWeeks;

    // Ensure we return at least week 1 and don't exceed total course weeks
    return Math.max(1, Math.min(Math.round(adjustedWeek), totalCourseWeeks));
}
