'use client';

import { useEffect } from 'react';
import Button from '@/components/ui/Button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AUMO Error]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <span className="text-6xl">⚠️</span>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Something went wrong</h1>
      <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
        {error?.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="secondary" onClick={() => (window.location.href = '/')}>
          Go Home
        </Button>
      </div>
    </div>
  );
}
