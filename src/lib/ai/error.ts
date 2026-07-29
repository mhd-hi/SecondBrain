export const AI_ERROR_CODES = [
  'AI_INPUT_TOO_LARGE',
  'AI_ABORTED',
  'AI_DEADLINE_EXCEEDED',
  'AI_PROVIDERS_EXHAUSTED',
] as const;

export type AIErrorCode = (typeof AI_ERROR_CODES)[number];

export class AIError extends Error {
  constructor(readonly code: AIErrorCode) {
    super(code);
    this.name = 'AIError';
  }
}
