import type { Task } from '@/types/task';
import * as React from 'react';
import { toast } from 'sonner';
import { updateTaskDueDate, useUpdateTaskField } from '@/hooks/task/use-task';

function getEditableEffort(task: Task) {
  return task.estimatedEffort > 0 ? task.estimatedEffort : undefined;
}

function normalizeEffortValue(estimatedEffort: number | undefined) {
  const rawValue = estimatedEffort ?? 0;

  if (!Number.isFinite(rawValue)) {
    return 0.5;
  }

  return rawValue < 0 ? 0.5 : Math.max(0, rawValue);
}

function getDueDateTime(dueDate: Date | string | null | undefined) {
  if (!dueDate) {
    return null;
  }

  const parsedDate = dueDate instanceof Date ? dueDate : new Date(dueDate);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
}

export function useTaskCard(task: Task) {
  const updateTaskField = useUpdateTaskField();
  const effortInputContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [isEditingEffort, setIsEditingEffort] = React.useState(false);
  const [editedEffort, setEditedEffort] = React.useState<number | undefined>(() => getEditableEffort(task));
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isEditingEffort) {
      return;
    }

    const input = effortInputContainerRef.current?.querySelector('input') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
  }, [isEditingEffort]);

  const saveTaskField = React.useCallback(async (input: string, value: string) => {
    await updateTaskField(task.id, input, value);
  }, [task.id, updateTaskField]);

  const saveTitle = React.useCallback(async (title: string) => {
    try {
      await saveTaskField('title', title);
    } catch (error) {
      toast.error('Failed to update task');
      throw error;
    }
  }, [saveTaskField]);

  const saveDescription = React.useCallback(async (description: string) => {
    try {
      await saveTaskField('notes', description);
    } catch (error) {
      toast.error('Failed to update task');
      throw error;
    }
  }, [saveTaskField]);

  const saveType = React.useCallback(async (type: Task['type']) => {
    setIsTypeDropdownOpen(false);

    if (type === task.type) {
      return;
    }

    await saveTaskField('type', type);
    toast.success('Task type updated');
  }, [saveTaskField, task.type]);

  const saveDueDate = React.useCallback(async (dueDate: Date | null | undefined) => {
    const nextDueDate = dueDate instanceof Date && !Number.isNaN(dueDate.getTime()) ? dueDate : undefined;
    const currentDueDateTime = getDueDateTime(task.dueDate);
    const nextDueDateTime = getDueDateTime(nextDueDate);

    if (currentDueDateTime === nextDueDateTime) {
      return;
    }

    if (nextDueDate) {
      await updateTaskDueDate(task.id, nextDueDate);
      toast.success('Due date updated');
      return;
    }

    await saveTaskField('dueDate', '');
    toast.success('Due date cleared');
  }, [saveTaskField, task.dueDate, task.id]);

  const startEffortEditing = React.useCallback(() => {
    setEditedEffort(getEditableEffort(task));
    setIsEditingEffort(true);
  }, [task]);

  const cancelEffortEditing = React.useCallback(() => {
    setEditedEffort(getEditableEffort(task));
    setIsEditingEffort(false);
  }, [task]);

  const saveEffort = React.useCallback(async () => {
    setIsEditingEffort(false);

    const nextEffort = normalizeEffortValue(editedEffort);
    const currentEffort = typeof task.estimatedEffort === 'number' ? task.estimatedEffort : 0;

    if (nextEffort === currentEffort) {
      return;
    }

    try {
      await saveTaskField('estimatedEffort', String(nextEffort));
      toast.success('Estimated effort updated');
    } catch (error) {
      console.error('Failed to save estimated effort', error);
      toast.error('Failed to update estimated effort');
      setEditedEffort(getEditableEffort(task));
    }
  }, [editedEffort, saveTaskField, task]);

  const handleEffortKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }

    if (event.key === 'Escape') {
      cancelEffortEditing();
    }
  }, [cancelEffortEditing]);

  return {
    editedEffort,
    effortInputContainerRef,
    handleEffortKeyDown,
    isEditingEffort,
    isTypeDropdownOpen,
    saveDescription,
    saveDueDate,
    saveEffort,
    saveTitle,
    saveType,
    setEditedEffort,
    setIsTypeDropdownOpen,
    startEffortEditing,
  };
}
