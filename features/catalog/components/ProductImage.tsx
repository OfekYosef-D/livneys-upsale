import Image, { type StaticImageData } from 'next/image';
import { productImages } from '@/lib/product-assets';

type ImageSource = { kind: 'static'; src: StaticImageData } | { kind: 'remote'; src: string } | { kind: 'none' };

/** Uploaded (https) images win; then a bundled catalog asset by file name; otherwise initials. */
export function resolveProductImage(product: { imageUrl?: string | null; assetImage?: string | null }): ImageSource {
  const url = product.imageUrl?.trim();
  if (url && /^https?:\/\//.test(url)) {
    const fileName = decodeURIComponent(url.split('?')[0]?.split('/').pop() ?? '');
    return productImages[fileName] ? { kind: 'static', src: productImages[fileName] } : { kind: 'remote', src: url };
  }
  const asset = product.assetImage ? productImages[product.assetImage] : undefined;
  return asset ? { kind: 'static', src: asset } : { kind: 'none' };
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length >= 2 ? `${words[0][0]}${words[1][0]}` : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

export function ProductImage({
  product,
  size = 'md',
}: {
  product: { name: string; imageUrl?: string | null; assetImage?: string | null };
  size?: 'sm' | 'md';
}) {
  const source = resolveProductImage(product);
  const frame = size === 'sm' ? 'h-10 w-10' : 'aspect-square w-full';
  const sizes = size === 'sm' ? '40px' : '96px';

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-md bg-[var(--pantry)] ${frame}`}>
      {source.kind === 'static' && <Image src={source.src} alt={product.name} fill sizes={sizes} className="object-cover" />}
      {source.kind === 'remote' && <Image src={source.src} alt={product.name} fill sizes={sizes} unoptimized className="object-cover" />}
      {source.kind === 'none' && (
        <span className="grid h-full w-full place-items-center text-xs font-semibold text-black/50" aria-label={product.name}>
          {initials(product.name)}
        </span>
      )}
    </div>
  );
}
