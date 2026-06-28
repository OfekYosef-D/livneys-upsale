import { describe, expect, it } from 'vitest';
import { compareNullableDateDesc, compareNumberDesc, compareText, filterAdminRecords, filterByValue, getUniqueFilterValues, resolveProductThumbnail, sortAdminRecords } from './ui-utils';

describe('admin CRM UI utilities', () => {
  it('filters records by search text and active status', () => {
    const records = [
      { name: 'Cafe South', route: 'South', isActive: true },
      { name: 'North Market', route: 'North', isActive: false },
      { name: 'Center Deli', route: 'Center', isActive: true },
    ];

    expect(
      filterAdminRecords(records, {
        search: 'north',
        status: 'all',
        getSearchText: (record) => [record.name, record.route],
      }),
    ).toEqual([records[1]]);

    expect(
      filterAdminRecords(records, {
        search: '',
        status: 'active',
        getSearchText: (record) => [record.name, record.route],
      }),
    ).toEqual([records[0], records[2]]);
  });

  it('builds stable select filter values and filters by normalized value', () => {
    const records = [
      { route: 'South' },
      { route: 'North' },
      { route: 'south' },
      { route: '' },
      { route: null },
      { route: 'Center' },
    ];

    expect(getUniqueFilterValues(records, (record) => record.route)).toEqual(['Center', 'North', 'South']);
    expect(filterByValue(records, 'all', (record) => record.route)).toEqual(records);
    expect(filterByValue(records, 'south', (record) => record.route)).toEqual([records[0], records[2]]);
  });

  it('sorts records without mutating the original list', () => {
    const records = [
      { name: 'Banana', total: 4, lastDate: '2026-01-01T00:00:00.000Z' },
      { name: 'Apple', total: 8, lastDate: null },
      { name: 'Cherry', total: 2, lastDate: '2026-01-03T00:00:00.000Z' },
    ];

    expect(sortAdminRecords(records, 'name', { name: (a, b) => compareText(a.name, b.name) }).map((record) => record.name)).toEqual(['Apple', 'Banana', 'Cherry']);
    expect(sortAdminRecords(records, 'total', { total: (a, b) => compareNumberDesc(a.total, b.total) }).map((record) => record.name)).toEqual(['Apple', 'Banana', 'Cherry']);
    expect(sortAdminRecords(records, 'date', { date: (a, b) => compareNullableDateDesc(a.lastDate, b.lastDate) }).map((record) => record.name)).toEqual(['Cherry', 'Banana', 'Apple']);
    expect(records.map((record) => record.name)).toEqual(['Banana', 'Apple', 'Cherry']);
  });

  it('resolves product thumbnails from asset image, local image URL, remote URL, then placeholder', () => {
    const knownAssets = new Set(['product-a.jpg', 'product-b.jpg']);

    expect(
      resolveProductThumbnail({
        name: 'Product A',
        assetImage: 'product-a.jpg',
        imageUrl: null,
        knownAssets,
      }),
    ).toEqual({ type: 'asset', assetKey: 'product-a.jpg', initials: 'PA' });

    expect(
      resolveProductThumbnail({
        name: 'Product B',
        assetImage: null,
        imageUrl: '/assets/product-b.jpg',
        knownAssets,
      }),
    ).toEqual({ type: 'asset', assetKey: 'product-b.jpg', initials: 'PB' });

    expect(
      resolveProductThumbnail({
        name: 'Remote Product',
        assetImage: null,
        imageUrl: 'https://example.com/product.jpg',
        knownAssets,
      }),
    ).toEqual({ type: 'url', src: 'https://example.com/product.jpg', initials: 'RP' });

    expect(
      resolveProductThumbnail({
        name: 'מוצר חדש',
        assetImage: null,
        imageUrl: null,
        knownAssets,
      }),
    ).toEqual({ type: 'placeholder', initials: 'מח' });
  });
});
