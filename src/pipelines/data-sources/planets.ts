import type { SchoolId } from '@/types/school';
import type {
  DataSource,
  SourceResult,
} from '@/types/server-pipelines/pipelines';
import { SchoolStrategyFactory } from '@/pipelines/school-strategies/strategy-factory';

/**
 * Data source for fetching course content from school systems
 * Uses strategy pattern to support multiple schools
 */
export class SchoolCourseDataSource implements DataSource {
  name: string;
  description: string;
  private schoolId: SchoolId;

  constructor(schoolId: SchoolId) {
    this.schoolId = schoolId;
    const strategy = SchoolStrategyFactory.getStrategy(schoolId);
    this.name = `school_${schoolId}`;
    this.description = `${strategy.name} Course Content`;
  }

  async fetch(courseCode: string, term: string): Promise<SourceResult> {
    const strategy = SchoolStrategyFactory.getStrategy(this.schoolId);
    const html = await strategy.fetchCourseContent(courseCode, term);

    return {
      data: html,
      metadata: {
        source: this.name,
        courseCode,
        term,
        schoolId: this.schoolId,
      },
    };
  }
}
