import { expect, test } from './fixtures/test';
import { TEST_IDS } from '@/lib/testing/selectors';
import { selectRadixOption } from './support/select-utils';

test.describe('Course Management', () => {
  const courseCode = 'CS101';

  test.beforeEach(async ({ app }) => {
    await app.dashboard.gotoAddCourse();
    await app.addCoursePage.create({
      code: courseCode,
      name: 'Introduction to Testing',
      school: 'none',
      daypart: 'AM',
    });
    await app.addCoursePage.goToCreatedCourse();
  });

  test('should allow a user to edit a course setting and preserve it on the course page', async ({ page }) => {
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Course settings' }).click();

    await selectRadixOption(page, page.locator('#update-course-color'), 'green');
    await selectRadixOption(page, page.locator('#update-course-daypart'), 'PM');

    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('heading', { name: courseCode, exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Course settings' }).click();

    await expect(page.locator('#update-course-color')).toContainText('green');
    await expect(page.locator('#update-course-daypart')).toContainText('PM');
  });

  test('should allow a user to delete a course', async ({ page }) => {
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete course' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByTestId(TEST_IDS.dashboard.page)).toBeVisible();
    await expect(page.getByRole('link', { name: courseCode })).not.toBeVisible();
  });
});
