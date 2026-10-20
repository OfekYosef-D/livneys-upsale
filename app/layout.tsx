import type React from 'react';
import { Suspense } from 'react';
import './globals.css';
import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import { NavigationProgress } from '@/components/ui/NavigationProgress';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
});

// A request-specific CSP nonce is injected by middleware. Rendering the whole
// application tree dynamically guarantees that Next.js emits the matching
// nonce on its runtime scripts instead of reusing nonce-less static output.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Livney's B2B",
  description: "Mobile-first B2B ordering prototype for Livney's customers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
