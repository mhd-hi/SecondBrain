import type { SchoolDataStrategy } from './base-strategy';
import type { SchoolId } from '@/types/school';
import { SCHOOL } from '@/types/school';
import { ETSStrategy } from './ets-strategy';

/**
 * Factory to get the appropriate school data strategy
 */
export class SchoolStrategyFactory {
  private static strategies = new Map<SchoolId, SchoolDataStrategy>([
    [SCHOOL.ETS, new ETSStrategy()],
    // Add more schools here as needed
  ]);

  /**
   * Get the strategy for a specific school
   * @param schoolId - School identifier
   * @returns Strategy instance
   * @throws Error if school is not supported
   */
  static getStrategy(schoolId: SchoolId): SchoolDataStrategy {
    const strategy = this.strategies.get(schoolId);
    if (!strategy) {
      throw new Error(
        `No strategy found for school: ${schoolId}. Supported schools: ${Array.from(this.strategies.keys()).join(', ')}`,
      );
    }
    return strategy;
  }
}
