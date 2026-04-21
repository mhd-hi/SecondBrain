import type { TEvent } from '@/calendar/types';
import type { StatusTask } from '@/types/status-task';
import type { Task } from '@/types/task';
import type { FilterType } from '@/types/todays-focus';
import { useCallback, useState } from 'react';
import { invalidateCalendarEvents } from '@/lib/stores/calendar-view-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { api } from '@/lib/utils/api/api-client-util';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';
import { withLoadingState } from '@/lib/utils/api/loading-util';
import { CommonErrorMessages } from '@/lib/utils/errors/error';

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

export function useUpdateTaskField() {
  const updateTask = useTaskStore(state => state.updateTask);

  return useCallback(async (taskId: string, input: string, value: string) => {
    updateTask(taskId, { [input]: value } as Partial<Task>);

    try {
      await api.post(
        API_ENDPOINTS.TASKS.UPDATE,
        { taskId, input, value },
        'Failed to update task',
      );
      invalidateCalendarEvents();
      return true;
    } catch (error) {
      console.error('Failed to update task field', error);
      throw error;
    }
  }, [updateTask]);
}

export async function updateTaskStatus(taskId: string, status: StatusTask) {
  const { getTask, updateTask } = useTaskStore.getState();
  const originalTask = getTask(taskId);

  if (originalTask) {
    updateTask(taskId, { status });
  }

  try {
    await api.patch(
      API_ENDPOINTS.TASKS.STATUS(taskId),
      { status },
      'Failed to update task status',
    );

    invalidateCalendarEvents();
    return true;
  } catch (error) {
    if (originalTask) {
      const currentTask = getTask(taskId);
      if (currentTask?.status === status) {
        updateTask(taskId, { status: originalTask.status });
      }
    }

    console.error('Failed to update task status', error);
    throw error;
  }
}

export async function updateTaskDueDate(taskId: string, dueDate: Date) {
  const { getTask, updateTask } = useTaskStore.getState();
  const originalTask = getTask(taskId);

  if (originalTask) {
    updateTask(taskId, { dueDate });
  }

  try {
    await api.patch(
      API_ENDPOINTS.TASKS.DETAIL(taskId),
      { dueDate: dueDate.toISOString() },
      CommonErrorMessages.TASK_DUE_DATE_UPDATE_FAILED,
    );

    invalidateCalendarEvents();
    return true;
  } catch (error) {
    if (originalTask) {
      const currentTask = getTask(taskId);
      const currentDueDate = currentTask?.dueDate instanceof Date
        ? currentTask.dueDate.getTime()
        : new Date(currentTask?.dueDate ?? '').getTime();

      if (currentDueDate === dueDate.getTime()) {
        updateTask(taskId, { dueDate: originalTask.dueDate });
      }
    }

    console.error('Failed to update task due date', error);
    throw error;
  }
}

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
