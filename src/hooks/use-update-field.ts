import { useCallback } from 'react';
import { invalidateCalendarEvents } from '@/lib/stores/calendar-view-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';

/**
 * Hook to update a field for a task or subtask via API.
 */
type UpdateFieldParams = {
  type: 'task' | 'subtask';
  id: string;
  input: string;
  value: string;
};

export function useUpdateField() {
  const updateTask = useTaskStore(state => state.updateTask);

  return useCallback(async (params: UpdateFieldParams) => {
    let endpoint = '';
    switch (params.type) {
      case 'task':
        endpoint = API_ENDPOINTS.TASKS.UPDATE;
        break;
      case 'subtask':
        endpoint = API_ENDPOINTS.TASKS.SUBTASK_UPDATE;
        break;
      default:
        console.error('Invalid type for update:', params.type);
        throw new Error('Invalid type for update');
    }

    const value = params.value;

    // Optimistic update in the store
    if (params.type === 'task') {
      updateTask(params.id, { [params.input]: value });
    } else if (params.type === 'subtask') {
      // For subtasks, we need the taskId to update - this would need to be passed in params
      // For now, skip optimistic update for subtasks
      // TODO: Enhance UpdateFieldParams to include taskId for subtask updates
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(params.type === 'task'
            ? { taskId: params.id }
            : { id: params.id }),
          input: params.input,
          value,
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to update');
      }
      if (params.type === 'task') {
        invalidateCalendarEvents();
      }
      return await res.json();
    } catch (err) {
      console.error('Failed to update field', err);
      throw err;
    }
  }, [updateTask]);
}
