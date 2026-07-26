import { z } from 'zod';
import { ApiError, apiFetch } from './api-client';

const dataSchema = z.object({ id: z.string() });

function mockFetchOnce(body: unknown, status = 200) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('apiFetch', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
    jest.restoreAllMocks();
  });

  it('returns validated data on a successful envelope', async () => {
    mockFetchOnce({ success: true, data: { id: 'abc' } });

    const result = await apiFetch('/api/v1/me', dataSchema);

    expect(result).toEqual({ id: 'abc' });
  });

  it('throws ApiError with the server message on an error envelope', async () => {
    mockFetchOnce({ success: false, error: 'Not found' }, 404);

    await expect(apiFetch('/api/v1/me', dataSchema)).rejects.toMatchObject({
      message: 'Not found',
      status: 404,
    });
  });

  it('throws a generic ApiError when the response does not match the envelope shape', async () => {
    mockFetchOnce({ unexpected: 'garbage' }, 200);

    await expect(apiFetch('/api/v1/me', dataSchema)).rejects.toBeInstanceOf(ApiError);
  });

  it('attaches the Authorization header when a token is provided', async () => {
    mockFetchOnce({ success: true, data: { id: 'abc' } });

    await apiFetch('/api/v1/me', dataSchema, { token: 'session-token' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/me',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer session-token' }),
      }),
    );
  });

  it('omits the Authorization header when no token is provided', async () => {
    mockFetchOnce({ success: true, data: { id: 'abc' } });

    await apiFetch('/api/v1/me', dataSchema);

    const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(init.headers).not.toHaveProperty('authorization');
  });

  it('throws when EXPO_PUBLIC_API_URL is not configured', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;

    await expect(apiFetch('/api/v1/me', dataSchema)).rejects.toThrow('EXPO_PUBLIC_API_URL');
  });
});
