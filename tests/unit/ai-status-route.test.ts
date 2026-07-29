import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildProviderHealthAttemptsMock = vi.fn();
const getAIClientMock = vi.fn();
const unstableCacheMock = vi.fn((callback: () => unknown) => callback);

vi.mock('next/cache', () => ({ unstable_cache: unstableCacheMock }));
vi.mock('@/lib/auth/api', () => ({
  withAuthSimple: vi.fn(
    (handler: (request: Request, user: { id: string }) => Promise<Response>) =>
      (request: Request) =>
        handler(request, { id: 'user-1' }),
  ),
}));
vi.mock('@/lib/ai/providers', () => ({
  buildProviderHealthAttempts: buildProviderHealthAttemptsMock,
}));
vi.mock('@/lib/ai/client', () => ({
  getAIClient: getAIClientMock,
}));

const { GET } = await import('@/app/api/ai/status/route');

beforeEach(() => {
  (buildProviderHealthAttemptsMock as unknown as Mock).mockReset();
  (getAIClientMock as unknown as Mock).mockReset();
});

describe('AI status route', () => {
  it('shares provider results for one minute', () => {
    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      ['ai-provider-health'],
      { revalidate: 60 },
    );
  });

  it('reports ok, provider errors, and unconfigured models safely', async () => {
    const okCreate = vi.fn().mockResolvedValue({ choices: [] });
    const failedCreate = vi
      .fn()
      .mockRejectedValue({ status: 429, message: 'secret provider message' });
    (buildProviderHealthAttemptsMock as unknown as Mock).mockReturnValue([
      {
        name: 'groq',
        model: 'model-ok',
        apiKey: 'secret',
        baseURL: 'https://groq',
        configured: true,
      },
      {
        name: 'nvidia',
        model: 'model-error',
        apiKey: 'secret',
        baseURL: 'https://nvidia',
        configured: true,
      },
      {
        name: 'openai',
        model: 'model-missing',
        configured: false,
      },
    ]);
    (getAIClientMock as unknown as Mock)
      .mockReturnValueOnce({ chat: { completions: { create: okCreate } } })
      .mockReturnValueOnce({ chat: { completions: { create: failedCreate } } });

    const response = await GET(
      new Request('http://localhost/api/ai/status') as never,
      {} as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body.models).toEqual([
      expect.objectContaining({
        provider: 'groq',
        model: 'model-ok',
        status: 'ok',
      }),
      expect.objectContaining({
        provider: 'nvidia',
        model: 'model-error',
        status: 'error',
        error: 'HTTP_429',
      }),
      {
        provider: 'openai',
        model: 'model-missing',
        status: 'error',
        error: 'NOT_CONFIGURED',
      },
    ]);
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('reports timed out model checks clearly', async () => {
    vi.useFakeTimers();
    const timeoutCreate = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error('secret generic timeout')),
              10_000,
            );
          }),
      );
    (buildProviderHealthAttemptsMock as unknown as Mock).mockReturnValue([
      {
        name: 'nvidia',
        model: 'meta/llama-3.3-70b-instruct',
        apiKey: 'secret',
        baseURL: 'https://nvidia',
        configured: true,
      },
    ]);
    (getAIClientMock as unknown as Mock).mockReturnValue({
      chat: { completions: { create: timeoutCreate } },
    });

    const responsePromise = GET(
      new Request('http://localhost/api/ai/status') as never,
      {} as never,
    );
    await vi.advanceTimersByTimeAsync(10_000);
    const response = await responsePromise;
    const body = await response.json();

    expect(body.models).toEqual([
      expect.objectContaining({
        provider: 'nvidia',
        model: 'meta/llama-3.3-70b-instruct',
        status: 'error',
        error: 'TIMEOUT',
      }),
    ]);
    expect(JSON.stringify(body)).not.toContain('secret generic timeout');

    vi.useRealTimers();
  });
});
