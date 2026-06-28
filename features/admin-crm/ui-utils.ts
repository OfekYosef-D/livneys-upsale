export type AdminStatusFilter = 'all' | 'active' | 'inactive';

export function filterAdminRecords<T extends { isActive: boolean }>(
  records: T[],
  {
    search,
    status,
    getSearchText,
  }: {
    search: string;
    status: AdminStatusFilter;
    getSearchText: (record: T) => Array<string | number | null | undefined>;
  },
): T[] {
  const normalizedSearch = search.trim().toLowerCase();

  return records.filter((record) => {
    if (status === 'active' && !record.isActive) return false;
    if (status === 'inactive' && record.isActive) return false;
    if (!normalizedSearch) return true;

    return getSearchText(record)
      .filter((value): value is string | number => value !== null && value !== undefined)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  });
}

export function filterByValue<T>(records: T[], value: string, getValue: (record: T) => string | null | undefined): T[] {
  const normalizedValue = normalizeFilterValue(value);
  if (normalizedValue === 'all') return records;

  return records.filter((record) => normalizeFilterValue(getValue(record)) === normalizedValue);
}

export function getUniqueFilterValues<T>(records: T[], getValue: (record: T) => string | null | undefined): string[] {
  const values = new Map<string, string>();

  records.forEach((record) => {
    const rawValue = getValue(record)?.trim();
    if (!rawValue) return;
    const normalizedValue = normalizeFilterValue(rawValue);
    if (!values.has(normalizedValue)) {
      values.set(normalizedValue, rawValue);
    }
  });

  return Array.from(values.values()).sort((a, b) => compareText(a, b));
}

export function sortAdminRecords<T, K extends string>(records: T[], sortKey: K, sorters: Record<K, (a: T, b: T) => number>): T[] {
  return [...records].sort(sorters[sortKey]);
}

export function compareText(a: string | null | undefined, b: string | null | undefined): number {
  return String(a ?? '').localeCompare(String(b ?? ''), 'he');
}

export function compareNumberDesc(a: number, b: number): number {
  return b - a;
}

export function compareNumberAsc(a: number, b: number): number {
  return a - b;
}

export function compareNullableDateDesc(a: string | null | undefined, b: string | null | undefined): number {
  const timeA = a ? new Date(a).getTime() : Number.NEGATIVE_INFINITY;
  const timeB = b ? new Date(b).getTime() : Number.NEGATIVE_INFINITY;
  return timeB - timeA;
}

export function compareNullableDateAsc(a: string | null | undefined, b: string | null | undefined): number {
  const timeA = a ? new Date(a).getTime() : Number.POSITIVE_INFINITY;
  const timeB = b ? new Date(b).getTime() : Number.POSITIVE_INFINITY;
  return timeA - timeB;
}

export type ProductThumbnail =
  | {
      type: 'asset';
      assetKey: string;
      initials: string;
    }
  | {
      type: 'url';
      src: string;
      initials: string;
    }
  | {
      type: 'placeholder';
      initials: string;
    };

export function resolveProductThumbnail({
  name,
  assetImage,
  imageUrl,
  knownAssets,
}: {
  name: string;
  assetImage?: string | null;
  imageUrl?: string | null;
  knownAssets: Set<string>;
}): ProductThumbnail {
  const initials = getInitials(name);

  if (assetImage && knownAssets.has(assetImage)) {
    return { type: 'asset', assetKey: assetImage, initials };
  }

  const imageAsset = extractKnownAssetFromUrl(imageUrl, knownAssets);
  if (imageAsset) {
    return { type: 'asset', assetKey: imageAsset, initials };
  }

  if (imageUrl && isSafeImageUrl(imageUrl)) {
    return { type: 'url', src: imageUrl, initials };
  }

  return { type: 'placeholder', initials };
}

function extractKnownAssetFromUrl(imageUrl: string | null | undefined, knownAssets: Set<string>): string | null {
  if (!imageUrl) return null;

  const withoutQuery = imageUrl.split('?')[0] ?? imageUrl;
  const rawFilename = withoutQuery.split('/').pop();
  if (!rawFilename) return null;

  const filename = decodeURIComponent(rawFilename);
  return knownAssets.has(filename) ? filename : null;
}

function isSafeImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function normalizeFilterValue(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }

  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}
