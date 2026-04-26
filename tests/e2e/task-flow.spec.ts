import { expect, test } from './fixtures/test';
import { TEST_IDS } from '@/lib/testing/selectors';

test('creates, filters, and updates a task from the course page', async ({ app, page }) => {
  const courseCode = 'TST201';

  await app.dashboard.gotoAddCourse();

  await app.addCoursePage.create({
    code: courseCode,
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
