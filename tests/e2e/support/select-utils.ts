import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function selectRadixOption(page: Page, trigger: Locator, optionLabel: string) {
  await trigger.click();

  const option = page.getByRole('option', { name: optionLabel, exact: true });

  await expect(option).toBeVisible();

  await option.click();
}
