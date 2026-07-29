import type { AITask } from '@/types/api/ai';
import { callWithFallback } from './call';
import { AIError } from './error';
import { parseCoursePlanTasks } from './parse';
import {
  buildCoursePlanParsePrompt,
  COURSE_PLAN_PARSER_SYSTEM_PROMPT,
} from './prompt';

type ParseAIResult = {
  tasks: AITask[];
};

export const MAX_COURSE_PLAN_HTML_LENGTH = 500_000;

export async function generateCoursePlanTasks(
  html: string,
  userContext?: string,
  signal?: AbortSignal,
): Promise<ParseAIResult> {
  if (html.length > MAX_COURSE_PLAN_HTML_LENGTH) {
    throw new AIError('AI_INPUT_TOO_LARGE');
  }

  const prompt = buildCoursePlanParsePrompt(html, userContext);
  const callResult = await callWithFallback(
    [
      { role: 'system', content: COURSE_PLAN_PARSER_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    {
      signal,
      validate: parseCoursePlanTasks,
      requestOptions: (attempt) => ({
        max_tokens: 8_192,
        ...(attempt.model === 'nvidia/nemotron-3-super-120b-a12b' && {
          temperature: 1,
          top_p: 0.95,
          reasoning_effort: 'none',
        }),
      }),
    },
  );

  return { tasks: parseCoursePlanTasks(callResult.text) };
}
