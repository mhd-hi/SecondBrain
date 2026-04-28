import { test as base, expect } from '@playwright/test';
import { buildE2ETestSeed } from '../support/mock-seed';
import type { AppFixture } from './app.fixture';
import { createAppFixture } from './app.fixture';

type TestFixtures = {
  app: AppFixture;
};

export const test = base.extend<TestFixtures>({
  app: async ({ page, context }, runFixture, testInfo) => {
    await runFixture(await createAppFixture({
      page,
      context,
      seed: buildE2ETestSeed(testInfo),
    }));
  },
});

export { expect };
