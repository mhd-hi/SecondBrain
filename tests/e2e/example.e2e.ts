import { expect, test } from './fixtures/test';
import { TEST_IDS } from '@/lib/testing/selectors';

test('authenticated session reaches the dashboard with an empty mocked course list', async ({ app, page }) => {
  await app.dashboard.goto();

  await expect(page.getByTestId(TEST_IDS.dashboard.courseListEmpty)).toBeVisible();
});
