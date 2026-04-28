/* eslint-disable ts/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as taskUtil from '@/lib/utils/task/task-util';
import * as termUtil from '@/lib/utils/term-util';
import { StatusTask } from '@/types/status-task';
import { TASK_TYPES } from '@/types/task';
import { restoreSystemDate, setSystemDate } from '../helpers/runtime';

describe('task-util', () => {
  beforeEach(() => {
    // Freeze time so overdue calculations are deterministic
    setSystemDate(new Date(2026, 1, 14, 12, 0, 0)); // 2026-02-14
  });

  afterEach(() => {
    restoreSystemDate();
  });

  it('calculateDueDateTaskForTerm: week 1 and week offsets, clamps to term end', () => {
    const start = new Date(2026, 0, 1); // Jan 1 2026
    const end = new Date(2026, 0, 31); // Jan 31 2026
    const spy = vi.spyOn(termUtil as any, 'getDatesForTerm').mockReturnValue({ start, end });

    const dueWeek1 = taskUtil.calculateDueDateTaskForTerm('term-x', 1);

    expect(dueWeek1.toISOString()).toBe(start.toISOString());

    const dueWeek3 = taskUtil.calculateDueDateTaskForTerm('term-x', 3);
    // week 3 = start + 14 days
    const expectedWeek3 = new Date(start);
    expectedWeek3.setDate(expectedWeek3.getDate() + (3 - 1) * 7);

    expect(dueWeek3.toISOString()).toBe(expectedWeek3.toISOString());

    // week beyond term end should return term end
    const dueLate = taskUtil.calculateDueDateTaskForTerm('term-x', 10);

    expect(dueLate.toISOString()).toBe(end.toISOString());

    spy.mockRestore();
  });

  it('getNextTask returns earliest non-completed task with valid dueDate', () => {
    const tasks: any[] = [
      { id: 1, status: StatusTask.TODO, dueDate: new Date(2026, 1, 20) },
      { id: 2, status: StatusTask.COMPLETED, dueDate: new Date(2026, 1, 10) },
      { id: 3, status: StatusTask.TODO, dueDate: new Date(2026, 1, 18) },
      { id: 4, status: StatusTask.TODO, dueDate: null },
    ];

    const next = taskUtil.getNextTask(tasks as any);

    expect(next?.id).toBe(3);
  });

  it('getUpcomingTask finds first exam/homework by due date', () => {
    const tasks: any[] = [
      { id: 1, status: StatusTask.TODO, type: 'note', dueDate: new Date(2026, 1, 12) },
      { id: 2, status: StatusTask.TODO, type: TASK_TYPES.EXAM, dueDate: new Date(2026, 1, 16) },
      { id: 3, status: StatusTask.TODO, type: TASK_TYPES.HOMEWORK, dueDate: new Date(2026, 1, 18) },
    ];

    const upcoming = taskUtil.getUpcomingTask(tasks as any);

    expect(upcoming?.id).toBe(2);
  });

  it('calculateProgress and counters', () => {
    const tasks: any[] = [
      { id: 1, status: StatusTask.COMPLETED },
      { id: 2, status: StatusTask.TODO },
      { id: 3, status: StatusTask.COMPLETED },
    ];

    expect(taskUtil.getCompletedTasksCount(tasks)).toBe(2);
    expect(taskUtil.getTotalTasksCount(tasks)).toBe(3);
    expect(taskUtil.calculateProgress(tasks)).toBeCloseTo((2 / 3) * 100);
  });

  it('status helpers: next status, validity, parse, classes', () => {
    expect(taskUtil.getNextStatusTask(StatusTask.TODO)).toBe(StatusTask.IN_PROGRESS);
    expect(taskUtil.getNextStatusTask(StatusTask.COMPLETED)).toBe(StatusTask.TODO);

    // isValidStatusTask
    expect(taskUtil.isValidStatusTask(StatusTask.TODO)).toBe(true);
    expect(taskUtil.isValidStatusTask('INVALID' as any)).toBe(false);

    // parseStatusTask
    expect(taskUtil.parseStatusTask(StatusTask.IN_PROGRESS)).toBe(StatusTask.IN_PROGRESS);
    expect(taskUtil.parseStatusTask('unknown')).toBe(StatusTask.TODO);

    // classes: should return a non-empty string for known statuses
    const bg = taskUtil.getStatusBgClass(StatusTask.COMPLETED);
    const text = taskUtil.getStatusTextClass(StatusTask.COMPLETED);

    expect(typeof bg).toBe('string');
    expect(bg.length).toBeGreaterThan(0);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('getOverdueTasks excludes completed and invalid dates', () => {
    // Today is 2026-02-14 (frozen). End of today is 2026-02-14T23:59:59
    const overdue = new Date(2026, 1, 10); // Feb 10 -> overdue
    const future = new Date(2026, 1, 20);

    const tasks: any[] = [
      { id: 1, status: StatusTask.TODO, dueDate: overdue },
      { id: 2, status: StatusTask.COMPLETED, dueDate: overdue },
      { id: 3, status: StatusTask.TODO, dueDate: future },
      { id: 4, status: StatusTask.TODO, dueDate: 'invalid-date' },
    ];

    const list = taskUtil.getOverdueTasks(tasks);

    expect(list.map(t => t.id)).toEqual([1]);
  });

  it('formatEffortTime formats correctly', () => {
    expect(taskUtil.formatEffortTime(0)).toBe('0min');
    expect(taskUtil.formatEffortTime(1.5)).toBe('1h 30min');
    expect(taskUtil.formatEffortTime(2)).toBe('2h');
    // small positive value -> at least 1min
    expect(taskUtil.formatEffortTime(0.001)).toBe('1min');
    expect(taskUtil.formatEffortTime(0.25)).toBe('15min');
  });
});
