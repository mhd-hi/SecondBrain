/**
 * Base strategy interface for school-specific course data fetching
 */
export type SchoolDataStrategy = {
  readonly id: string;
  readonly name: string;

  /**
   * Fetch course content from the school's system
   * @param courseCode - Course code (e.g., "MAT145")
   * @param term - Term identifier (e.g., "20252")
   * @returns HTML content of the course plan
   */
  fetchCourseContent: (courseCode: string, term: string) => Promise<string>;

  /**
   * Validate if the fetched content is valid
   * @param html - HTML content to validate
   * @returns true if valid, throws error with message if invalid
   */
  validateContent: (html: string) => boolean;
};

/**
 * Error thrown when course data fetching fails
 */
export class CourseDataFetchError extends Error {
  constructor(
    message: string,
    public readonly schoolId: string,
    public readonly courseCode: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CourseDataFetchError';
  }
}
