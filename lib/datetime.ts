/**
 * All business dates (deliveries, cut-offs, promotions) are Israeli wall-clock times.
 * Servers run in UTC and browsers may not, so every conversion and every rendered date
 * goes through this module with an explicit time zone. This also keeps server-rendered
 * HTML identical to the hydrated client output.
 */
export const ISRAEL_TIME_ZONE = 'Asia/Jerusalem';

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
};

const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ISRAEL_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});

export function getZonedParts(date: Date): ZonedParts {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdayIndex[parts.weekday] ?? 0,
  };
}

function getOffsetMs(date: Date): number {
  const parts = getZonedParts(date);
  const wallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wallClockAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Converts an Israeli wall-clock time to the matching UTC instant (DST aware). */
export function zonedTimeToUtc({
  year,
  month,
  day,
  hour = 0,
  minute = 0,
}: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = getOffsetMs(new Date(guess));
  let instant = guess - firstOffset;
  const secondOffset = getOffsetMs(new Date(instant));
  if (secondOffset !== firstOffset) instant = guess - secondOffset;
  return new Date(instant);
}

/** Adds calendar days while keeping the Israeli wall-clock time (a week is not always 168 hours). */
export function addZonedDays(date: Date, days: number): Date {
  const parts = getZonedParts(date);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return zonedTimeToUtc({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
  });
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Value for `<input type="date">`, in Israeli time. */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return '';
  const parts = getZonedParts(new Date(value));
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Value for `<input type="datetime-local">`, in Israeli time. */
export function toDateTimeInputValue(value: Date | string | null | undefined): string {
  if (!value) return '';
  const parts = getZonedParts(new Date(value));
  return `${toDateInputValue(value)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** Parses `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` as Israeli wall-clock time. Returns null for invalid input. */
export function parseIsraelDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour = '0', minute = '0'] = match;
  const date = zonedTimeToUtc({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  });
  return Number.isNaN(date.getTime()) ? null : date;
}

function createFormatter(options: Intl.DateTimeFormatOptions) {
  const formatter = new Intl.DateTimeFormat('he-IL', { timeZone: ISRAEL_TIME_ZONE, ...options });
  return (value: Date | string) => formatter.format(new Date(value));
}

/** 20.10.2026 */
export const formatDate = createFormatter({ day: '2-digit', month: '2-digit', year: 'numeric' });
/** 20 באוקטובר 2026 */
export const formatLongDate = createFormatter({ day: 'numeric', month: 'long', year: 'numeric' });
/** יום שלישי, 20 באוקטובר */
export const formatWeekdayDate = createFormatter({ weekday: 'long', day: 'numeric', month: 'long' });
/** 20.10.2026, 18:00 */
export const formatDateTime = createFormatter({
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
/** 20.10, 18:00 */
export const formatShortDateTime = createFormatter({
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const hebrewWeekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;
