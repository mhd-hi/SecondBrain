/**
 * School identifiers and configuration
 */
export const SCHOOL = {
  NONE: 'none',
  ETS: 'ets',
} as const;

export type SchoolId = (typeof SCHOOL)[keyof typeof SCHOOL];

/**
 * Default school selection for the add course form
 * Change this to set a different default school
 */
export const DEFAULT_SCHOOL: SchoolId = SCHOOL.ETS;

/**
 * School display information
 */
export const SCHOOL_INFO: Record<SchoolId, { label: string }> = {
  [SCHOOL.NONE]: {
    label: 'None',
  },
  [SCHOOL.ETS]: {
    label: 'ÉTS - École de technologie supérieure',
  },
};
