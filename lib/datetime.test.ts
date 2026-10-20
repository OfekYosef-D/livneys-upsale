import { describe, expect, it } from 'vitest';
import {
  addZonedDays,
  formatDate,
  getZonedParts,
  parseIsraelDateTime,
  toDateInputValue,
  toDateTimeInputValue,
  zonedTimeToUtc,
} from './datetime';

describe('Israel time helpers', () => {
  it('converts Israeli wall-clock time to UTC in winter (+02:00) and summer (+03:00)', () => {
    expect(zonedTimeToUtc({ year: 2026, month: 1, day: 13, hour: 8 }).toISOString()).toBe('2026-01-13T06:00:00.000Z');
    expect(zonedTimeToUtc({ year: 2026, month: 7, day: 14, hour: 8 }).toISOString()).toBe('2026-07-14T05:00:00.000Z');
  });

  it('keeps the wall-clock time when adding a week across the DST change', () => {
    // Israel leaves daylight saving time on the last Sunday of October 2026 (Oct 25).
    const beforeChange = zonedTimeToUtc({ year: 2026, month: 10, day: 20, hour: 8 });
    const afterChange = addZonedDays(beforeChange, 7);
    expect(getZonedParts(afterChange)).toMatchObject({ year: 2026, month: 10, day: 27, hour: 8, minute: 0 });
    expect(afterChange.getTime() - beforeChange.getTime()).toBe(7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000);
  });

  it('round-trips form input values in Israeli time regardless of the server time zone', () => {
    const value = parseIsraelDateTime('2026-10-20T18:00')!;
    expect(value.toISOString()).toBe('2026-10-20T15:00:00.000Z');
    expect(toDateTimeInputValue(value)).toBe('2026-10-20T18:00');
    expect(toDateInputValue(value)).toBe('2026-10-20');
    expect(parseIsraelDateTime('not a date')).toBeNull();
  });

  it('formats dates in Israeli time, so a late-evening UTC instant shows the next Israeli day', () => {
    expect(formatDate('2026-10-20T22:30:00.000Z')).toBe('21.10.2026');
  });
});
