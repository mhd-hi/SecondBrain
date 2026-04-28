import type { AITask } from '@/types/api/ai';
import * as Sentry from '@/lib/sentry-utils';
import { callOpenAI } from './call';
import { extractJsonArrayFromText } from './parse';
import {
  buildCoursePlanParsePrompt,
  COURSE_PLAN_PARSER_SYSTEM_PROMPT,
} from './prompt';

type ParseAIResult = {
  tasks: AITask[];
};

export async function parseContentWithAI(
  html: string,
  userContext?: string,
): Promise<ParseAIResult> {
  const prompt = buildCoursePlanParsePrompt(html, userContext);
  await Sentry.logger.info('Reporting OpenAI payload to Sentry', {
    htmlLength: html.length,
    userContextLength: userContext?.length ?? 0,
    userContextPreview: userContext?.slice(0, 500) ?? '',
    promptLength: prompt.length,
  });
  await Sentry.captureException(new Error('OpenAI payload sent'), {
    htmlLength: html.length,
    userContextLength: userContext?.length ?? 0,
    userContextPreview: userContext?.slice(0, 500) ?? '',
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, 500),
  });

  console.log('Built prompt. Length:', prompt.length, 'characters');
  if (userContext) {
    console.log(
      'User context provided. Length:',
      userContext.length,
      'characters',
    );
    console.log('User context content:', userContext);
  }

  try {
    console.log('Starting OpenAI API call...');
    const callResult = await callOpenAI([
      { role: 'system', content: COURSE_PLAN_PARSER_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ]);

    console.log('OpenAI API call completed');
    console.log('Model used:', callResult.model);
    console.log('Total tokens:', callResult.usage?.total_tokens);

    const aiText = callResult.text;
    if (!aiText || !aiText.trim()) {
      console.log('OpenAI response is empty');
      throw new Error('No response from OpenAI');
    }

    console.log('AI response length:', aiText.length, 'characters');
    console.log('AI response snapshot:', aiText.substring(0, 1000));

    // Parse JSON array from text
    const rawTasks: AITask[] = extractJsonArrayFromText(aiText);
    console.log('Parsed JSON array. Items:', rawTasks.length);

    // Return raw AI tasks - normalization will happen when creating database tasks
    console.log('Returning raw AI tasks. Count:', rawTasks.length);

    return { tasks: rawTasks };
  } catch (error) {
    console.log(
      'Error in parseContentWithAI:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    throw error;
  }
}
