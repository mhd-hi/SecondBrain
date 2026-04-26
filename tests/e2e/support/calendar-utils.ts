import type { Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { format } from 'date-fns';

async function goToCalendarMonth(calendar: Locator, date: Date) {
  const targetCaption = format(date, 'LLLL y');

  for (let attempt = 0; attempt < 24; attempt++) {
    const caption = (await calendar.locator('[aria-live="polite"]').first().textContent())?.trim();

    if (!caption) {
      throw new Error('Calendar caption is not available.');
    }

    if (caption === targetCaption) {
      return;
    }

    const visibleMonth = new Date(`${caption} 1`);
    if (Number.isNaN(visibleMonth.getTime())) {
      throw new TypeError(`Calendar caption could not be parsed: ${caption}`);
    }

    const nextTarget = new Date(date.getFullYear(), date.getMonth(), 1);
    const nextButtonName = visibleMonth < nextTarget ? 'Go to next month' : 'Go to previous month';

    await calendar.getByRole('button', { name: nextButtonName, exact: true }).click();
  }

  throw new Error(`Could not navigate calendar to ${targetCaption}`);
}

export async function pickCalendarDate(trigger: Locator, calendar: Locator, date: Date) {
  await trigger.click();

  await expect(calendar).toBeVisible();

  await goToCalendarMonth(calendar, date);

  const dayButton = calendar.getByRole('button', {
    name: format(date, 'do MMMM (EEEE)'),
    exact: true,
  });

  await dayButton.click();

  await expect(calendar).toBeHidden();
}
