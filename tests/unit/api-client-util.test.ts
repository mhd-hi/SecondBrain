import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiErrorHandlerMock = vi.fn();
const originalFetch = globalThis.fetch;

vi.mock('@/lib/utils/errors/error', () => ({
  ErrorHandlers: {
    api: (...args: unknown[]) => apiErrorHandlerMock(...args),
    silent: vi.fn(),
  },
}));

function setFetchMock(fetchMock: typeof fetch) {
  Object.defineProperty(globalThis, 'fetch', {
    value: fetchMock,
    configurable: true,
    writable: true,
  });
}

describe('api client util', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    setFetchMock(originalFetch);
    vi.restoreAllMocks();
  });

  it('includes status, statusText, and response body in thrown API errors', async () => {
    const { api } = await import('@/lib/utils/api/api-client-util');
    setFetchMock(vi.fn().mockResolvedValue({
      ok: false,
      status: 418,
      statusText: "I'm a teapot",
      text: vi.fn().mockResolvedValue('brewing failed'),
    } as unknown as Response) as unknown as typeof fetch);

    await expect(
      api.get('/api/test', 'Fetch failed'),
    ).rejects.toThrow("API request failed: 418 I'm a teapot. brewing failed");

    expect(apiErrorHandlerMock).toHaveBeenCalledWith(expect.any(Error), 'Fetch failed');
  });

  it('serializes JSON payloads for post requests', async () => {
    const { api } = await import('@/lib/utils/api/api-client-util');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as Response);
    setFetchMock(fetchMock as unknown as typeof fetch);

    await expect(
      api.post('/api/test', { title: 'Task' }, 'Post failed'),
    ).resolves.toEqual({ success: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Task' }),
    });
  });

  it('serializes JSON payloads for patch requests', async () => {
    const { api } = await import('@/lib/utils/api/api-client-util');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as Response);
    setFetchMock(fetchMock as unknown as typeof fetch);

    await api.patch('/api/test', { status: 'DONE' }, 'Patch failed');

    expect(fetchMock).toHaveBeenCalledWith('/api/test', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DONE' }),
    });
  });

  it('uses the expected request shape for get and delete', async () => {
    const { api } = await import('@/lib/utils/api/api-client-util');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ removed: true }),
      } as unknown as Response);
    setFetchMock(fetchMock as unknown as typeof fetch);

    await api.get('/api/test');
    await api.delete('/api/test');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/test', { method: 'GET' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/test', { method: 'DELETE' });
  });

  it('calls the consolidated API error handler on network failures', async () => {
    const { api } = await import('@/lib/utils/api/api-client-util');
    const networkError = new Error('network down');
    setFetchMock(vi.fn().mockRejectedValue(networkError) as unknown as typeof fetch);

    await expect(
      api.get('/api/test', 'Network failed'),
    ).rejects.toThrow('network down');

    expect(apiErrorHandlerMock).toHaveBeenCalledWith(networkError, 'Network failed');
  });
});
