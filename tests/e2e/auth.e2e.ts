import { expect, test } from './fixtures/test';
import { TEST_IDS } from '@/lib/testing/selectors';

test('should allow a user to log in and view the dashboard', async ({ app, page }) => {
  // The login is handled by the app fixture, so we just need to go to the dashboard.
  await app.dashboard.goto();

  // Verify that the user is redirected to the dashboard.
  await expect(page).toHaveURL('/');

  // Assert that the dashboard contains expected elements.
  await expect(page.getByTestId(TEST_IDS.dashboard.page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
