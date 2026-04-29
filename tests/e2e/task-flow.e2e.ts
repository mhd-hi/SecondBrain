import { expect, test } from './fixtures/test';
import { TEST_IDS } from '@/lib/testing/selectors';

test('creates, filters, and updates a task from the course page', async ({ app, page }) => {
  const courseCode = 'TST201';

  await app.dashboard.gotoAddCourse();

  await app.addCoursePage.create({
    code: courseCode,
    name: courseCode,
    school: 'none',
    daypart: 'PM',
  });
  await app.addCoursePage.goToCreatedCourse();

  await app.coursePage.addTask({
    title: 'Read chapter 1',
    notes: 'Focus on sections 1 and 2',
    type: 'homework',
    estimatedEffort: 2,
  });

  await app.coursePage.searchTasks('Read chapter 1');

  const taskCard = page.getByTestId(TEST_IDS.task.card).filter({
    has: page.getByText('Read chapter 1', { exact: true }),
  }).first();

  await expect(taskCard).toBeVisible();

  await app.coursePage.changeTaskStatus('Read chapter 1', 'DOING');

  await expect(taskCard.getByTestId(TEST_IDS.task.statusTrigger)).toContainText('DOING');
});

test('hides completed tasks on the course page', async ({ app, page }) => {
  const courseCode = 'TST202';
  const taskTitle = 'Finish the report';

  await app.dashboard.gotoAddCourse();

  await app.addCoursePage.create({
    code: courseCode,
    name: courseCode,
    school: 'none',
    daypart: 'PM',
  });
  await app.addCoursePage.goToCreatedCourse();

  await app.coursePage.addTask({
    title: taskTitle,
    notes: 'Wrap up the final draft',
    type: 'homework',
    dueDate: new Date(2026, 4, 8),
    estimatedEffort: 2,
  });

  await app.coursePage.changeTaskStatus(taskTitle, 'DONE');

  const taskCard = page.getByTestId(TEST_IDS.task.card).filter({
    has: page.getByText(taskTitle, { exact: true }),
  }).first();
  const hideCompletedToggle = page.getByTestId(TEST_IDS.coursePage.hideCompletedToggle);

  await expect(taskCard).not.toBeVisible();

  await hideCompletedToggle.click();

  const hideCompletedCheckbox = page.getByRole('checkbox', { name: 'Hide completed tasks' });

  await expect(hideCompletedCheckbox).toBeChecked();

  await hideCompletedCheckbox.uncheck();

  await expect(taskCard).toBeVisible();

  await hideCompletedToggle.click();

  const hideCompletedCheckboxAfterReopen = page.getByRole('checkbox', { name: 'Hide completed tasks' });

  await expect(hideCompletedCheckboxAfterReopen).not.toBeChecked();

  await hideCompletedCheckboxAfterReopen.check();

  await expect(taskCard).not.toBeVisible();
});
