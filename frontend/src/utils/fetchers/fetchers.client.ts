'use client';

import { fetchApi, streamingFetchApi } from './fetchers';
import { FetchOptions } from './fetchers.utils';

export const defaultFetchFn = async <TResponseData, TRequestBody = unknown>(
  path: string,
  options?: FetchOptions<TRequestBody>,
): Promise<TResponseData> => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  const url = new URL(`/${path}`, baseUrl);

  return fetchApi(url.toString(), options);
};

export const streamingFetchFn = async <TRequestBody = unknown>(
  path: string,
  options?: FetchOptions<TRequestBody>,
): Promise<Response> => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  const url = new URL(`/${path}`, baseUrl);

  return streamingFetchApi(url.toString(), options);
};
