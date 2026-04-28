import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildDefaultTaskDraft,
  buildTaskFromSubtask,
  DEFAULT_TASK_ESTIMATED_EFFORT,
  getDefaultTaskDueDate,
  getTaskEstimatedEffortInputValue,
  isValidTaskEstimatedEffort,
  MIN_TASK_ESTIMATED_EFFORT,
  parseTaskEstimatedEffortInput,
} from '@/lib/utils/task/task-draft';
import { restoreSystemDate, setSystemDate } from '../helpers/runtime';

describe('task draft utils', () => {
  beforeEach(() => {
    setSystemDate(new Date('2026-04-01T10:00:00.000Z'));
  });

  afterEach(() => {
    restoreSystemDate();
  });

  it('builds the default task draft with shared defaults', () => {
    const draft = buildDefaultTaskDraft();

    expect(draft).toMatchObject({
      title: '',
      notes: '',
      estimatedEffort: DEFAULT_TASK_ESTIMATED_EFFORT,
      type: 'theorie',
      status: 'TODO',
    });
    expect(draft.dueDate.toISOString()).toBe('2026-04-08T10:00:00.000Z');
  });

  it('preserves an explicit due date when building a default draft', () => {
    const dueDate = new Date('2026-05-10T15:00:00.000Z');

    const draft = buildDefaultTaskDraft({ dueDate });

    expect(draft.dueDate.toISOString()).toBe(dueDate.toISOString());
    expect(draft.dueDate).not.toBe(dueDate);
  });

  it('builds a task draft from a subtask and falls back to the shared due-date default', () => {
    const draft = buildTaskFromSubtask({
      title: 'Review notes',
      notes: 'Summarize chapter 4',
    });

    expect(draft).toMatchObject({
      title: 'Review notes',
      notes: 'Summarize chapter 4',
      estimatedEffort: DEFAULT_TASK_ESTIMATED_EFFORT,
      type: 'theorie',
      status: 'TODO',
    });
    expect(draft.dueDate.toISOString()).toBe(getDefaultTaskDueDate().toISOString());
  });

  it('accepts string due dates when converting a subtask to a task draft', () => {
    const draft = buildTaskFromSubtask(
      {
        title: 'Convert me',
        notes: '',
      },
      { dueDate: '2026-05-20T12:00:00.000Z' },
    );

    expect(draft.dueDate.toISOString()).toBe('2026-05-20T12:00:00.000Z');
    expect(draft.estimatedEffort).toBe(DEFAULT_TASK_ESTIMATED_EFFORT);
  });

  it('formats estimated effort values for numeric inputs', () => {
    expect(getTaskEstimatedEffortInputValue(DEFAULT_TASK_ESTIMATED_EFFORT)).toBe('3');
    expect(getTaskEstimatedEffortInputValue(1.5)).toBe('1.5');
  });

  it('parses estimated effort input strings and rejects invalid numbers', () => {
    expect(parseTaskEstimatedEffortInput('2.5')).toBe(2.5);
    expect(parseTaskEstimatedEffortInput(' 1 ')).toBe(1);
    expect(parseTaskEstimatedEffortInput('')).toBeNull();
    expect(parseTaskEstimatedEffortInput('abc')).toBeNull();
  });

  it('validates estimated effort against the shared minimum', () => {
    expect(isValidTaskEstimatedEffort(MIN_TASK_ESTIMATED_EFFORT)).toBe(true);
    expect(isValidTaskEstimatedEffort(2)).toBe(true);
    expect(isValidTaskEstimatedEffort(0.25)).toBe(false);
    expect(isValidTaskEstimatedEffort(Number.NaN)).toBe(false);
  });
});
