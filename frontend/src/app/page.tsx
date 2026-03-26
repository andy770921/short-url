'use client';

import { useForm } from 'react-hook-form';
import { useCreateShortUrl } from '@/queries/use-create-short-url';
import { useState } from 'react';
import type { CreateShortUrlResponse } from '@repo/shared';
import { CUSTOM_ALIAS_MAX_LENGTH, CUSTOM_ALIAS_PATTERN } from '@repo/shared';

interface FormValues {
  longUrl: string;
  customAlias: string;
}

export default function Home() {
  const [result, setResult] = useState<CreateShortUrlResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { longUrl: '', customAlias: '' },
  });

  const { mutate, isPending, error } = useCreateShortUrl();

  const onSubmit = (data: FormValues) => {
    setCopied(false);
    setResult(null);
    mutate(
      {
        longUrl: data.longUrl,
        customAlias: data.customAlias || undefined,
      },
      {
        onSuccess: (res) => setResult(res),
      },
    );
  };

  const copyToClipboard = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Zap</h1>
          <p className="mt-2 text-slate-500">Instant short links. Share fast, everywhere.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="longUrl" className="block text-sm font-medium text-slate-700 mb-1">
                Paste your long URL
              </label>
              <input
                id="longUrl"
                type="url"
                placeholder="https://example.com/very/long/path"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                {...register('longUrl', {
                  required: 'URL is required',
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Enter a valid URL starting with http:// or https://',
                  },
                })}
              />
              {errors.longUrl && (
                <p className="mt-1 text-sm text-red-500">{errors.longUrl.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="customAlias"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Custom alias <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="customAlias"
                type="text"
                placeholder="my-link"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                {...register('customAlias', {
                  pattern: {
                    value: CUSTOM_ALIAS_PATTERN,
                    message: 'Only letters, numbers, hyphens, and underscores',
                  },
                  maxLength: {
                    value: CUSTOM_ALIAS_MAX_LENGTH,
                    message: `Max ${CUSTOM_ALIAS_MAX_LENGTH} characters`,
                  },
                })}
              />
              {errors.customAlias && (
                <p className="mt-1 text-sm text-red-500">{errors.customAlias.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
            >
              {isPending ? 'Shortening...' : 'Shorten URL'}
            </button>
          </form>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-700">
                {error.message || 'Something went wrong. Please try again.'}
              </p>
            </div>
          )}

          {result && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-3">
              <p className="text-sm text-emerald-700 font-medium">Your short URL is ready!</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-white border border-emerald-300 px-3 py-2 text-sm text-slate-800 font-mono truncate">
                  {result.shortUrl}
                </code>
                <button
                  onClick={copyToClipboard}
                  className="shrink-0 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition cursor-pointer"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-emerald-600">
                Expires:{' '}
                {result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : 'Never'}
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Links expire after 30 days by default.
        </p>
      </div>
    </main>
  );
}
