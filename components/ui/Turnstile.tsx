'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Cloudflare Turnstile bot check, rendered explicitly on every mount. The implicit mode only
 * scans the page once when the script first loads, so after a client-side navigation back to
 * the form the widget silently never appeared and every submission was rejected.
 */
export function Turnstile({
  siteKey,
  onToken,
  resetSignal = 0,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  /** Increment to request a fresh challenge (tokens are single-use). */
  resetSignal?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const tokenHandler = useRef(onToken);
  tokenHandler.current = onToken;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !container.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      language: 'he',
      callback: (token: string) => tokenHandler.current(token),
      'expired-callback': () => tokenHandler.current(null),
      'error-callback': () => tokenHandler.current(null),
    });
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [ready, siteKey]);

  useEffect(() => {
    if (resetSignal > 0 && widgetId.current) {
      tokenHandler.current(null);
      window.turnstile?.reset(widgetId.current);
    }
  }, [resetSignal]);

  return (
    <>
      {/* onReady also fires when the script was already loaded by an earlier visit. */}
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div ref={container} className="min-h-[65px]" />
    </>
  );
}
