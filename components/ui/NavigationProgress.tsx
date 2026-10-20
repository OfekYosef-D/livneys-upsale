'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type ProgressState = 'idle' | 'loading' | 'finishing';

function isInternalNavigationClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const anchor = (event.target as HTMLElement | null)?.closest('a');
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return false;

  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;

  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) {
    return false;
  }

  return true;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<ProgressState>('idle');
  const locationKey = `${pathname}?${searchParams.toString()}`;
  const locationKeyRef = useRef(locationKey);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!isInternalNavigationClick(event)) return;
      setState('loading');
    }

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (locationKeyRef.current === locationKey) return;
    locationKeyRef.current = locationKey;
    setState((current) => (current === 'idle' ? current : 'finishing'));
  }, [locationKey]);

  useEffect(() => {
    if (state !== 'finishing') return;
    const timeout = window.setTimeout(() => setState('idle'), 220);
    return () => window.clearTimeout(timeout);
  }, [state]);

  if (state === 'idle') return null;

  return (
    <div className="ui-nav-progress" data-state={state} role="progressbar" aria-hidden="true">
      <div className="ui-nav-progress__bar" />
    </div>
  );
}
