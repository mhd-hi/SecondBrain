import { expect, test } from './fixtures/test';
import type { Page } from '@playwright/test';
import { TEST_IDS } from '@/lib/testing/selectors';
import { pickCalendarDate } from './support/calendar-utils';

function getTaskCard(page: Page, title: string) {
  return page.getByTestId(TEST_IDS.task.card).filter({
    has: page.getByText(title, { exact: true }),
  }).first();
}

test.describe('Task Management', () => {
  const courseCode = 'TST201';

  test.beforeEach(async ({ app }) => {
    await app.dashboard.gotoAddCourse();
    await app.addCoursePage.create({
      code: courseCode,
      name: 'Task Management Course',
      school: 'none',
      daypart: 'PM',
    });
    await app.addCoursePage.goToCreatedCourse();
  });

  test('should allow a user to perform full CRUD on a task', async ({ app, page }) => {
    const taskTitle = 'Read chapter 1';
    const updatedTaskTitle = 'Read chapter 1 and summarize';
    const taskNotes = 'Focus on sections 1 and 2';
    const updatedTaskNotes = 'Focus on sections 1, 2, and 3';
    const initialDueDate = new Date(2026, 4, 5);
    const updatedDueDate = new Date(2026, 4, 12);

    await app.coursePage.addTask({
      title: taskTitle,
      notes: taskNotes,
      type: 'homework',
      dueDate: initialDueDate,
      estimatedEffort: 2,
    });

    const originalCard = getTaskCard(page, taskTitle);

    await expect(originalCard).toBeVisible();

    await originalCard.getByRole('button', { name: taskTitle, exact: true }).click();
    const titleInput = page.getByPlaceholder('Task title');
    await titleInput.fill(updatedTaskTitle);
    await titleInput.press('Enter');

    const updatedCard = getTaskCard(page, updatedTaskTitle);

    await expect(updatedCard).toBeVisible();

    await updatedCard.getByRole('button', { name: taskNotes, exact: true }).click();
    const notesInput = page.getByPlaceholder('Task description');
    await notesInput.fill(updatedTaskNotes);
    await notesInput.press('Tab');

    const dueDateTrigger = updatedCard.getByTestId(TEST_IDS.task.dueDateTrigger);
    const dueDateBefore = await dueDateTrigger.textContent();
    await pickCalendarDate(dueDateTrigger, page.getByTestId(TEST_IDS.task.dueDateCalendar), updatedDueDate);

    await expect(dueDateTrigger).not.toHaveText(dueDateBefore ?? '');

    await expect(getTaskCard(page, updatedTaskTitle)).toBeVisible();
    await expect(updatedCard.getByRole('button', { name: updatedTaskTitle, exact: true })).toBeVisible();
    await expect(updatedCard.getByRole('button', { name: updatedTaskNotes, exact: true })).toBeVisible();

    await updatedCard.hover();
    await updatedCard.getByTestId(TEST_IDS.task.actionsTrigger).click();
    await page.getByRole('menuitem', { name: 'Delete task' }).click();

    await expect(getTaskCard(page, updatedTaskTitle)).not.toBeVisible();
  });

  test('should allow a user to manage subtasks', async ({ app, page }) => {
    const parentTaskTitle = 'Prepare presentation';
    const parentTaskNotes = 'Outline the main sections first';
    const parentDueDate = new Date(2026, 4, 19);
    const firstSubtaskTitle = 'Draft outline';
    const firstSubtaskNotes = 'List the main slides';
    const secondSubtaskTitle = 'Gather sources';
    const secondSubtaskNotes = 'Find two references';

    await app.coursePage.addTask({
      title: parentTaskTitle,
      notes: parentTaskNotes,
      type: 'homework',
      dueDate: parentDueDate,
      estimatedEffort: 3,
    });

    const parentCard = getTaskCard(page, parentTaskTitle);

    await expect(parentCard).toBeVisible();

    await parentCard.hover();
    await parentCard.getByTestId(TEST_IDS.task.actionsTrigger).click();
    await page.getByRole('menuitem', { name: 'Add subtask' }).click();
    await page.getByLabel('Title').fill(firstSubtaskTitle);
    await page.getByLabel('Description').fill(firstSubtaskNotes);
    await page.getByRole('button', { name: 'Add Subtask' }).click();

    await parentCard.hover();
    await parentCard.getByTestId(TEST_IDS.task.actionsTrigger).click();
    await page.getByRole('menuitem', { name: 'Add subtask' }).click();
    await page.getByLabel('Title').fill(secondSubtaskTitle);
    await page.getByLabel('Description').fill(secondSubtaskNotes);
    await page.getByRole('button', { name: 'Add Subtask' }).click();

    const subtasksToggle = parentCard.getByRole('button', { name: /2 Subtasks?/ });

    await expect(subtasksToggle).toBeVisible();

    await subtasksToggle.click();

    const subtaskRows = parentCard.locator('#subtasks-list > div > div');

    await expect(subtaskRows).toHaveCount(2);

    const firstSubtaskRow = subtaskRows.first();
    await firstSubtaskRow.hover();
    await firstSubtaskRow.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Convert to task' }).click();

    await expect(getTaskCard(page, firstSubtaskTitle)).toBeVisible();

    const remainingSubtaskRow = parentCard.locator('#subtasks-list > div > div').first();
    await remainingSubtaskRow.hover();
    await remainingSubtaskRow.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete subtask' }).click();

    await expect(parentCard.getByText(secondSubtaskTitle, { exact: true })).not.toBeVisible();
  });

  test('should allow a user to search for tasks by title', async ({ app, page }) => {
    const tasks = [
      { title: 'Alpha task', status: 'TODO' as const, dueDate: new Date(2026, 4, 1) },
      { title: 'Beta task', status: 'DOING' as const, dueDate: new Date(2026, 4, 8) },
      { title: 'Gamma task', status: 'DONE' as const, dueDate: new Date(2026, 4, 15) },
    ];

    for (const task of tasks) {
      await app.coursePage.addTask({
        title: task.title,
        notes: `${task.title} notes`,
        type: 'homework',
        dueDate: task.dueDate,
        estimatedEffort: 1.5,
      });

      if (task.status !== 'TODO') {
        await app.coursePage.changeTaskStatus(task.title, task.status);
      }
    }

    await app.coursePage.searchTasks('Beta task');

    await expect(getTaskCard(page, 'Beta task')).toBeVisible();
    await expect(getTaskCard(page, 'Alpha task')).not.toBeVisible();
    await expect(getTaskCard(page, 'Gamma task')).not.toBeVisible();

    await page.getByTestId(TEST_IDS.coursePage.searchInput).clear();

    await expect(getTaskCard(page, 'Alpha task')).toBeVisible();
    await expect(getTaskCard(page, 'Beta task')).toBeVisible();
    await expect(getTaskCard(page, 'Gamma task')).toBeVisible();
  });
});
