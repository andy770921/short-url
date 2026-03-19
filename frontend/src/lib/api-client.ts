import type { HealthResponse } from '@repo/shared';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  health: {
    get: () => get<HealthResponse>('/api/health'),
  },
};
