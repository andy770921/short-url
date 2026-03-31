'use client';

import { useForm } from 'react-hook-form';
import { useCreateShortUrl } from '@/queries/use-create-short-url';
import { useState } from 'react';
import type { CreateShortUrlResponse } from '@repo/shared';
import { CUSTOM_ALIAS_MAX_LENGTH, CUSTOM_ALIAS_PATTERN } from '@repo/shared';
import { ThemeToggle } from '@/components/theme-toggle';

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
    <main className="relative min-h-screen bg-slate-50 dark:bg-[#09090b] flex items-center justify-center px-4 overflow-hidden transition-colors duration-500">
      {/* Aurora gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[300px] -left-[200px] h-[600px] w-[600px] rounded-full bg-violet-500/15 dark:bg-violet-600/25 blur-[120px] animate-aurora-1" />
        <div className="absolute -bottom-[200px] -right-[200px] h-[500px] w-[500px] rounded-full bg-cyan-400/10 dark:bg-cyan-500/20 blur-[120px] animate-aurora-2" />
        <div className="absolute top-[40%] left-[55%] h-[450px] w-[450px] rounded-full bg-fuchsia-400/10 dark:bg-fuchsia-500/15 blur-[120px] animate-aurora-3" />
      </div>

      {/* Dot grid overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(120, 120, 140, 0.07) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Subtle center radial glow */}
      <div
        className="pointer-events-none absolute inset-0 dark:opacity-100 opacity-50"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.06) 0%, transparent 60%)',
        }}
      />

      <ThemeToggle />

      <div className="relative z-10 w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Zap
            </span>
          </h1>
          <p className="mt-3 text-lg text-slate-500 dark:text-zinc-400">
            Instant short links. Share fast, everywhere.
          </p>
        </div>

        {/* Glassmorphic card */}
        <div className="rounded-2xl p-6 space-y-5 bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl border border-slate-200/60 dark:border-white/[0.08] shadow-xl shadow-slate-300/30 dark:shadow-black/40 transition-colors duration-300">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Long URL input */}
            <div>
              <label
                htmlFor="longUrl"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5"
              >
                Paste your long URL
              </label>
              <input
                id="longUrl"
                type="url"
                placeholder="https://example.com/very/long/path"
                className="w-full rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-4 py-3 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/50 dark:focus:border-violet-400/40 focus:ring-1 focus:ring-violet-500/20 dark:focus:ring-violet-400/20 focus:shadow-[0_0_20px_rgba(139,92,246,0.1)] dark:focus:shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-all duration-200"
                {...register('longUrl', {
                  required: 'URL is required',
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Enter a valid URL starting with http:// or https://',
                  },
                })}
              />
              {errors.longUrl && (
                <p className="mt-1.5 text-sm text-red-500 dark:text-red-400">
                  {errors.longUrl.message}
                </p>
              )}
            </div>

            {/* Custom alias input */}
            <div>
              <label
                htmlFor="customAlias"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5"
              >
                Custom alias{' '}
                <span className="text-slate-400 dark:text-zinc-500 font-normal">(optional)</span>
              </label>
              <input
                id="customAlias"
                type="text"
                placeholder="my-link"
                className="w-full rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-4 py-3 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/50 dark:focus:border-violet-400/40 focus:ring-1 focus:ring-violet-500/20 dark:focus:ring-violet-400/20 focus:shadow-[0_0_20px_rgba(139,92,246,0.1)] dark:focus:shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-all duration-200"
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
                <p className="mt-1.5 text-sm text-red-500 dark:text-red-400">
                  {errors.customAlias.message}
                </p>
              )}
            </div>

            {/* Gradient glow button */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 bg-[length:200%_100%] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 dark:shadow-violet-500/30 hover:bg-right hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] dark:hover:shadow-[0_0_30px_rgba(139,92,246,0.45)] focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#09090b] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-500 cursor-pointer"
            >
              {isPending ? 'Shortening...' : 'Shorten URL'}
            </button>
          </form>

          {/* Error state */}
          {error && (
            <div className="rounded-xl bg-red-50/80 dark:bg-red-500/[0.08] border border-red-200/60 dark:border-red-500/20 backdrop-blur-sm p-4 transition-colors duration-200">
              <p className="text-sm text-red-600 dark:text-red-400">
                {error.message || 'Something went wrong. Please try again.'}
              </p>
            </div>
          )}

          {/* Success state */}
          {result && (
            <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-500/[0.07] border border-emerald-200/60 dark:border-emerald-500/20 backdrop-blur-sm p-4 space-y-3 transition-colors duration-200">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Your short URL is ready!
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-white/80 dark:bg-white/[0.05] border border-emerald-200/60 dark:border-emerald-500/15 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 font-mono truncate">
                  {result.shortUrl}
                </code>
                <button
                  onClick={copyToClipboard}
                  className="shrink-0 rounded-lg bg-emerald-600 dark:bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 dark:hover:bg-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-200 cursor-pointer"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-500/80">
                Expires:{' '}
                {result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : 'Never'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 dark:text-zinc-600 mt-6">
          Links expire after 30 days by default.
        </p>
      </div>
    </main>
  );
}
