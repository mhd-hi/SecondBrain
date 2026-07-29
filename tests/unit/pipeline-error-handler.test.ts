import { expect, it } from 'vitest';
import { PipelineErrorHandlers } from '@/lib/utils/errors/error';

it('shows a useful message when all AI providers are unavailable', () => {
  expect(
    PipelineErrorHandlers.getSafeErrorMessage(
      'API request failed: 503. AI processing is temporarily unavailable',
    ),
  ).toBe(
    'AI providers are temporarily unavailable. Please retry in a few minutes.',
  );
});
