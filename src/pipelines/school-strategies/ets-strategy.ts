import type { SchoolDataStrategy } from './base-strategy';
import * as cheerio from 'cheerio';
import { normalizeHtml } from '@/lib/utils/html-util';
import { buildPlanETSUrl as buildPlanETSURL } from '@/lib/utils/url-util';
import { SCHOOL } from '@/types/school';
import { CourseDataFetchError } from './base-strategy';

/**
 * Strategy for fetching course data from ÉTS (École de technologie supérieure)
 * Uses the PlanETS system
 */
export class ETSStrategy implements SchoolDataStrategy {
  readonly id = SCHOOL.ETS;
  readonly name = 'ÉTS';

  public async fetchCourseContent(
    courseCode: string,
    term: string,
  ): Promise<string> {
    const planUrl = buildPlanETSURL(courseCode, term);

    try {
      const htmlResponse = await fetch(planUrl);
      if (!htmlResponse.ok) {
        throw new CourseDataFetchError(
          `Failed to fetch course data: ${htmlResponse.status} ${htmlResponse.statusText}`,
          this.id,
          courseCode,
        );
      }

      const pageHtml = await htmlResponse.text();
      const extractedHtml = this.extractRelevantContent(pageHtml);
      const normalizedHtml = normalizeHtml(extractedHtml);

      this.validateContent(normalizedHtml);
      return normalizedHtml;
    } catch (error) {
      if (error instanceof CourseDataFetchError) {
        throw error;
      }
      throw new CourseDataFetchError(
        `Network error fetching course data: ${error instanceof Error ? error.message : String(error)}`,
        this.id,
        courseCode,
        error,
      );
    }
  }

  public validateContent(html: string): boolean {
    if (!html || html.trim().length < 100) {
      throw new CourseDataFetchError(
        'Course data appears to be empty or invalid',
        this.id,
        'unknown',
      );
    }
    return true;
  }

  private extractRelevantContent(pageHtml: string): string {
    const $ = cheerio.load(pageHtml);
    const contentDiv = $('#divContenusTrai');

    if (!contentDiv.length) {
      throw new CourseDataFetchError(
        'Content div not found in PlanETS page',
        this.id,
        'unknown',
      );
    }

    const relevantHtml = contentDiv.html();
    if (!relevantHtml) {
      throw new CourseDataFetchError(
        'No HTML content found in course page',
        this.id,
        'unknown',
      );
    }

    return relevantHtml;
  }
}
