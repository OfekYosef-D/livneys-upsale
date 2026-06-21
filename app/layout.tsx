import type React from 'react';
import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Livneys B2B Reorder', description: 'Prototype for route-based B2B reorder and upsell' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="he" dir="rtl"><body>{children}</body></html>; }
