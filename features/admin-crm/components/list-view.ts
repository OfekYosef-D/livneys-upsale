'use client';

import { useMemo, useState } from 'react';

export type StatusFilter = 'all' | 'active' | 'inactive';

type ListViewConfig<T, S extends string> = {
  records: readonly T[];
  /** Values matched (case-insensitive) by the free-text search. */
  searchText: (record: T) => Array<string | number | null | undefined>;
  /** Comparator per sort option; the first one is the default. */
  sorters: Record<S, (a: T, b: T) => number>;
  defaultSort: NoInfer<S>;
  /** Records without `isActive` are never filtered by status. */
  defaultStatus?: StatusFilter;
  /** Exact-match dropdown filters, e.g. by route or category. */
  facets?: Record<string, (record: T) => string | null | undefined>;
};

/** Search + active/inactive + dropdown facets + sort, shared by every admin list. */
export function useListView<T extends object, S extends string>(config: ListViewConfig<T, S>) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>(config.defaultStatus ?? 'all');
  const [sort, setSort] = useState<S>(config.defaultSort);
  const [facetValues, setFacetValues] = useState<Record<string, string>>({});

  const facetOptions = useMemo(
    () => Object.fromEntries(Object.entries(config.facets ?? {}).map(([key, getValue]) => [
      key,
      [...new Set(config.records.map(getValue).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'he')),
    ])),
    [config.facets, config.records],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return config.records
      .filter((record) => status === 'all' || !('isActive' in record) || record.isActive === (status === 'active'))
      .filter((record) => Object.entries(config.facets ?? {}).every(([key, getValue]) => !facetValues[key] || facetValues[key] === 'all' || getValue(record) === facetValues[key]))
      .filter((record) => !needle || config.searchText(record).some((value) => value !== null && value !== undefined && String(value).toLowerCase().includes(needle)))
      .sort(config.sorters[sort]);
  }, [config, facetValues, search, sort, status]);

  return {
    visible,
    total: config.records.length,
    search,
    setSearch,
    status,
    setStatus,
    sort,
    setSort,
    facetOptions,
    facetValue: (key: string) => facetValues[key] ?? 'all',
    setFacet: (key: string, value: string) => setFacetValues((current) => ({ ...current, [key]: value })),
  };
}

export const compareText = (a?: string | null, b?: string | null) => (a ?? '').localeCompare(b ?? '', 'he');
export const compareDateDesc = (a?: string | null, b?: string | null) => (b ? Date.parse(b) : -Infinity) - (a ? Date.parse(a) : -Infinity);
export const compareDateAsc = (a?: string | null, b?: string | null) => (a ? Date.parse(a) : Infinity) - (b ? Date.parse(b) : Infinity);
