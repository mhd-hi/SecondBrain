import type { Subtask } from '@/types/subtask';
import * as React from 'react';
import { toast } from 'sonner';
import { deleteSubtask } from '@/hooks/task/use-subtask';
import { useUpdateField } from '@/hooks/use-update-field';
import { useTaskStore } from '@/lib/stores/task-store';
import { buildTaskFromSubtask } from '@/lib/utils/task/task-draft';

type UseSubtaskActionsParams = {
  taskId?: string;
  courseId?: string | null;
  courseIdDueDate?: Date | string | undefined;
  onDeleteSubtask?: (subtaskId: string) => void;
  onEditSubtask?: (subtaskId: string, changes: Partial<Subtask>) => void;
  onTaskAdded?: () => void;
};

function notifyTaskAdded(onTaskAdded?: () => void) {
  if (!onTaskAdded) {
    return;
  }

  try {
    onTaskAdded();
  } catch (error) {
    console.warn('onTaskAdded callback failed', error);
  }
}

export function useSubtaskActions({
  taskId,
  courseId,
  courseIdDueDate,
  onDeleteSubtask,
  onEditSubtask,
  onTaskAdded,
}: UseSubtaskActionsParams) {
  const updateField = useUpdateField();
  const createTask = useTaskStore(state => state.createTask);
  const deleteSubtaskFromStore = useTaskStore(state => state.deleteSubtask);

  const saveSubtaskField = React.useCallback(async (
    subtaskId: string,
    input: 'title' | 'notes',
    value: string,
    changes: Partial<Subtask>,
  ) => {
    await updateField({
      type: 'subtask',
      id: subtaskId,
      input,
      value,
    });

    onEditSubtask?.(subtaskId, changes);
  }, [onEditSubtask, updateField]);

  const saveSubtaskTitle = React.useCallback(async (subtaskId: string, title: string) => {
    await saveSubtaskField(subtaskId, 'title', title, { title });
  }, [saveSubtaskField]);

  const saveSubtaskNotes = React.useCallback(async (subtaskId: string, notes: string) => {
    await saveSubtaskField(subtaskId, 'notes', notes, { notes });
  }, [saveSubtaskField]);

  const deleteSubtaskAction = React.useCallback(async (subtaskId: string) => {
    try {
      if (!taskId) {
        throw new Error('Missing task id');
      }

      const deleted = await deleteSubtask(taskId, subtaskId);
      if (!deleted) {
        throw new Error('Failed to delete');
      }

      deleteSubtaskFromStore(taskId, subtaskId);
      toast.success('Subtask deleted');
      onDeleteSubtask?.(subtaskId);
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete subtask');
    }
  }, [deleteSubtaskFromStore, onDeleteSubtask, taskId]);

  const convertSubtaskToTask = React.useCallback(async (subtask: Subtask) => {
    try {
      if (!taskId) {
        throw new Error('Missing task id');
      }

      if (!courseId) {
        toast.error('Cannot convert subtask to task: parent task has no course');
        console.warn('Convert aborted: courseId is falsy', { taskId, courseId, courseIdDueDate, subtask });
        return;
      }

      const created = await createTask(
        courseId,
        buildTaskFromSubtask(subtask, { dueDate: courseIdDueDate }),
      );

      if (!created) {
        throw new Error('Failed to create task');
      }

      notifyTaskAdded(onTaskAdded);

      const deleted = await deleteSubtask(taskId, subtask.id);
      if (!deleted) {
        console.warn('Failed to delete subtask after conversion', { taskId, subtaskId: subtask.id });
        toast.success('Subtask converted to task (subtask not removed)');
        return;
      }

      deleteSubtaskFromStore(taskId, subtask.id);
      toast.success('Subtask converted to task');
      onDeleteSubtask?.(subtask.id);
    } catch (error) {
      console.error(error);
      toast.error('Failed to convert subtask to task');
    }
  }, [
    courseId,
    courseIdDueDate,
    createTask,
    deleteSubtaskFromStore,
    onDeleteSubtask,
    onTaskAdded,
    taskId,
  ]);

  return {
    convertSubtaskToTask,
    deleteSubtask: deleteSubtaskAction,
    saveSubtaskNotes,
    saveSubtaskTitle,
  };
}
