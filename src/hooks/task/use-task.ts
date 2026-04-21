import type { TEvent } from '@/calendar/types';
import type { StatusTask } from '@/types/status-task';
import type { Task } from '@/types/task';
import type { FilterType } from '@/types/todays-focus';
import { useCallback, useState } from 'react';
import { invalidateCalendarEvents } from '@/lib/stores/calendar-view-store';
import { api } from '@/lib/utils/api/api-client-util';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';
import { withLoadingState } from '@/lib/utils/api/loading-util';

export const fetchFocusTasks = async (filter: FilterType): Promise<Task[]> => {
  return api.get(
    `${API_ENDPOINTS.TASKS.FOCUS}?filter=${filter}`,
    'Failed to fetch focus tasks',
  );
};

const fetchCalendarTasks = async (startDate: Date, endDate: Date): Promise<TEvent[]> => {
  return api.get(`${API_ENDPOINTS.TASKS.CALENDAR}?start=${startDate.toISOString()}&end=${endDate.toISOString()}`, 'Failed to fetch calendar tasks');
};

export const batchUpdateStatusTask = async (taskIds: string[], status: StatusTask): Promise<{
  updatedCount: number;
  status: StatusTask;
  updatedTasks: Task[];
}> => {
  const response = await api.patch<{
    updatedCount: number;
    status: StatusTask;
    updatedTasks: Task[];
  }>(API_ENDPOINTS.TASKS.BATCH_STATUS, { taskIds, status }, 'Failed to batch update task status');
  invalidateCalendarEvents();
  return response;
};

export const useCalendarTasks = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCalendarTasks = useCallback(async (startDate: Date, endDate: Date): Promise<TEvent[]> => {
    setError(null);
    return withLoadingState(async () => {
      try {
        return await fetchCalendarTasks(startDate, endDate);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch calendar tasks';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }, setIsLoading);
  }, []);

  return { getCalendarTasks, isLoading, error };
};
