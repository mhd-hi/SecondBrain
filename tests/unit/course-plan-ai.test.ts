import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const callWithFallbackMock = vi.fn();

vi.mock('@/lib/ai/call', () => ({
  callWithFallback: callWithFallbackMock,
}));

const { generateCoursePlanTasks, MAX_COURSE_PLAN_HTML_LENGTH } =
  await import('@/lib/ai/course-plan');

const validResponse =
  '[{"week":1,"type":"theorie","title":"Task","estimatedEffort":1}]';

beforeEach(() => {
  (callWithFallbackMock as unknown as Mock).mockReset();
  (callWithFallbackMock as unknown as Mock).mockResolvedValue({
    text: validResponse,
  });
});

describe('generateCoursePlanTasks', () => {
  it('rejects oversized HTML before starting a provider call', async () => {
    await expect(
      generateCoursePlanTasks('x'.repeat(MAX_COURSE_PLAN_HTML_LENGTH + 1)),
    ).rejects.toMatchObject({ code: 'AI_INPUT_TOO_LARGE' });
    expect(callWithFallbackMock).not.toHaveBeenCalled();
  });

  it('caps output, passes cancellation, and omits shared sampling options', async () => {
    const controller = new AbortController();
    await generateCoursePlanTasks('<p>plan</p>', 'context', controller.signal);

    const [, options] = (callWithFallbackMock as unknown as Mock).mock
      .calls[0]!;
    expect(options.signal).toBe(controller.signal);
    expect(
      options.requestOptions({
        name: 'groq',
        model: 'openai/gpt-oss-120b',
      }),
    ).toEqual({ max_tokens: 8_192 });
    expect(
      options.requestOptions({
        name: 'nvidia',
        model: 'nvidia/nemotron-3-super-120b-a12b',
      }),
    ).toEqual({
      max_tokens: 8_192,
      temperature: 1,
      top_p: 0.95,
      reasoning_effort: 'none',
    });
  });

  it('validates task and subtask collection limits', async () => {
    await generateCoursePlanTasks('<p>plan</p>');
    const [, options] = (callWithFallbackMock as unknown as Mock).mock
      .calls[0]!;
    const task = {
      week: 1,
      type: 'theorie',
      title: 'Task',
      estimatedEffort: 1,
    };

    expect(() =>
      options.validate(JSON.stringify(Array.from({ length: 101 }, () => task))),
    ).toThrow();
    expect(() =>
      options.validate(
        JSON.stringify([
          {
            ...task,
            subtasks: Array.from({ length: 26 }, () => ({ title: 'Subtask' })),
          },
        ]),
      ),
    ).toThrow();
    expect(() =>
      options.validate(JSON.stringify([{ ...task, title: 'x'.repeat(301) }])),
    ).toThrow();
    expect(() =>
      options.validate(JSON.stringify([{ ...task, notes: 'x'.repeat(2_001) }])),
    ).toThrow();
    expect(() => options.validate(validResponse)).not.toThrow();
  });
});
