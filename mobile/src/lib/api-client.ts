import { apiResponseSchema, type PaginationMeta } from '@creatordocks/shared';
import { z } from 'zod';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

async function apiRequest<T>(
  path: string,
  dataSchema: z.ZodType<T>,
  options: RequestOptions,
): Promise<{ data: T; meta?: PaginationMeta }> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not set');

  const res = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const json: unknown = await res.json();
  const parsed = apiResponseSchema(dataSchema).safeParse(json);

  if (!parsed.success) {
    throw new ApiError('Unexpected response from server', res.status);
  }

  if (!parsed.data.success) {
    throw new ApiError(parsed.data.error, res.status);
  }

  return { data: parsed.data.data, meta: parsed.data.meta };
}

/**
 * Fetches from the mobile API and validates the response at runtime against
 * the shared schema — never trust the network, even our own API (see
 * docs/platform-split/03-ios-app.md). Token attachment is the caller's job
 * (via Clerk's getToken()) so this module stays testable without Clerk.
 */
export async function apiFetch<T>(
  path: string,
  responseSchema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const { data } = await apiRequest(path, responseSchema, options);
  return data;
}

/** Like apiFetch, but for paginated list endpoints — keeps the meta (total/page/limit). */
export async function apiFetchList<T>(
  path: string,
  itemSchema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<{ data: T[]; meta: PaginationMeta }> {
  const { data, meta } = await apiRequest(path, z.array(itemSchema), options);
  return { data, meta: meta ?? { total: data.length, page: 1, limit: Math.max(data.length, 1) } };
}
