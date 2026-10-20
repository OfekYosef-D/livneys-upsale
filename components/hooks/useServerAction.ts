'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import type { ActionFailure, ActionResult } from '@/lib/action-result';

export type Feedback = { ok: boolean; message: string };

type RunOptions<T> = {
  /** Message shown on success; a function can use the returned data. */
  success?: string | ((data: T) => string);
  onSuccess?: (data: T) => void;
  onError?: (failure: ActionFailure) => void;
  /** Re-render server components after success (default true). */
  refresh?: boolean;
};

/**
 * Runs a server action inside a transition and keeps the pending state and the last outcome.
 * Every admin and customer screen uses this instead of hand-rolling the same state machine.
 */
export function useServerAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const run = useCallback(<T>(call: () => Promise<ActionResult<T>>, options: RunOptions<T> = {}, key: string | null = null) => {
    setFeedback(null);
    setActiveKey(key);
    startTransition(async () => {
      const result = await call();
      if (result.ok) {
        const message = typeof options.success === 'function' ? options.success(result.data) : options.success;
        setFeedback(message ? { ok: true, message } : null);
        if (options.refresh !== false) router.refresh();
        options.onSuccess?.(result.data);
      } else {
        setFeedback({ ok: false, message: result.error });
        options.onError?.(result);
      }
    });
  }, [router]);

  return {
    run,
    pending,
    feedback,
    /** True while the action started with this key is running (for per-row spinners). */
    isPending: (key: string) => pending && activeKey === key,
    fail: (message: string) => setFeedback({ ok: false, message }),
    clear: () => setFeedback(null),
  };
}
