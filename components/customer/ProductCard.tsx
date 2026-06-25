'use client';
import Image from 'next/image';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import type { PortalProduct } from '@/features/customer-portal/types';
import { money } from '@/lib/format';
import { fallbackProductImage, productImages } from '@/lib/product-assets';

export function ProductCard({ product, qty, onQty }: { product: PortalProduct; qty: number; onQty: (v: number) => void }) {
  const image = productImages[product.assetImage ?? ''] ?? fallbackProductImage;

  return (
    <article className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      <div className="relative h-32 w-full bg-[#e6e1d8]">
        <Image src={image} alt={product.name} fill sizes="(max-width: 768px) 100vw, 25vw" className="object-cover" />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-black text-black/45">{product.category}</p>
            <h3 className="font-black">{product.name}</h3>
            <p className="text-sm text-black/50">{product.unit}</p>
          </div>
          <b>{money(product.price)}</b>
        </div>
        <div className="mt-4">
          <QuantityStepper value={qty} min={product.minQty ?? 1} step={product.minQty ?? 1} onChange={onQty} />
        </div>
      </div>
    </article>
  );
}
