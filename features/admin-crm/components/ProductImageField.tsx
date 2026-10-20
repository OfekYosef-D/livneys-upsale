'use client';

import { ImageUp } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { ProductImage } from '../../catalog/components/ProductImage';

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const maxBytes = 5 * 1024 * 1024;

/** Upload to Cloudinary (when configured) or paste an image URL; the result is submitted as `imageUrl`. */
export function ProductImageField({
  name,
  defaultUrl,
  assetImage,
  uploadEnabled,
}: {
  name: string;
  defaultUrl: string | null;
  assetImage: string | null;
  uploadEnabled: boolean;
}) {
  const [imageUrl, setImageUrl] = useState(defaultUrl ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!allowedTypes.includes(file.type)) return setMessage('אפשר להעלות JPG, PNG, WebP או GIF בלבד.');
    if (file.size > maxBytes) return setMessage('התמונה גדולה מדי (עד 5MB).');

    setUploading(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/admin/product-images', { method: 'POST', body });
      const result = (await response.json().catch(() => ({}))) as { imageUrl?: string; error?: string };
      if (!response.ok || !result.imageUrl) throw new Error(result.error ?? 'העלאת התמונה נכשלה.');
      setImageUrl(result.imageUrl);
      setMessage('התמונה הועלתה. היא תישמר עם המוצר.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'העלאת התמונה נכשלה.');
    } finally {
      setUploading(false);
      input.value = '';
    }
  }

  return (
    <div className="grid gap-3 rounded-md border border-[var(--pantry-line)] p-3 sm:grid-cols-[6rem_1fr]">
      <div className="relative w-24">
        <ProductImage product={{ name: 'תמונת מוצר', imageUrl, assetImage }} />
        {uploading && <div className="absolute inset-0 grid place-items-center bg-white/70"><Spinner size={20} label="מעלה תמונה" /></div>}
      </div>
      <div className="space-y-2">
        <label className="block">
          <span className="ui-label">קישור לתמונה</span>
          <input name={name} type="url" dir="ltr" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" className="ui-field" />
        </label>
        {uploadEnabled ? (
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md bg-black px-3 text-xs font-semibold text-white hover:bg-black/85">
            <ImageUp size={15} aria-hidden="true" /> העלאת תמונה מהמחשב
            <input type="file" accept={allowedTypes.join(',')} className="sr-only" disabled={uploading} onChange={upload} />
          </label>
        ) : (
          <p className="text-xs text-black/50">העלאת קבצים לא הוגדרה (Cloudinary). אפשר להדביק קישור לתמונה.</p>
        )}
        {message && <p className="text-xs text-black/65" role="status">{message}</p>}
      </div>
    </div>
  );
}
