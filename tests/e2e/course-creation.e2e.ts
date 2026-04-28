import { expect, test } from './fixtures/test';

test('creates a course through the add-course page and opens it', async ({ app, page }) => {
  const courseCode = 'TST101';

  await app.dashboard.gotoAddCourse();

  await app.addCoursePage.create({
    code: courseCode,
    name: courseCode,
    school: 'none',
    daypart: 'AM',
  });
  await app.addCoursePage.goToCreatedCourse();

  await expect(page.getByRole('heading', { name: courseCode, exact: true })).toBeVisible();
});
