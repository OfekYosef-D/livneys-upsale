import { z } from 'zod';
import he from 'zod/v4/locales/he.js';
import { parseIsraelDateTime } from './datetime';

// Validation messages are shown to Hebrew-speaking users. Only the Hebrew locale is imported
// (not the whole `z.locales` namespace) to keep client bundles small.
z.config(he());

export { z };

/** Reusable field schemas shared by every form in the app. */
export const fields = {
  id: z.string().trim().min(1).max(120),

  requiredText: (max: number) => z.string().trim().min(1, 'שדה חובה.').max(max),

  /** Empty strings become null so optional text columns stay clean. */
  optionalText: (max: number) =>
    z.preprocess((value) => {
      if (value === undefined || value === null) return null;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }, z.string().max(max).nullable()),

  email: z.string().trim().toLowerCase().email('כתובת אימייל לא תקינה.').max(254),

  optionalEmail: z.preprocess((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().email('כתובת אימייל לא תקינה.').max(254).nullable()),

  phone: z.string().trim().min(9, 'מספר טלפון לא תקין.').max(40),

  optionalNumber: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? null : value),
    z.coerce.number().nullable(),
  ),

  positivePrice: z.coerce.number().positive('המחיר חייב להיות גדול מאפס.').max(1_000_000),

  /** An Israeli wall-clock date-time from a form input; already-parsed Dates pass through. */
  israelDateTime: z.preprocess(
    (value) => (typeof value === 'string' ? parseIsraelDateTime(value) ?? value : value),
    z.date('תאריך לא תקין.'),
  ),

  optionalIsraelDateTime: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') return null;
      return typeof value === 'string' ? parseIsraelDateTime(value) ?? value : value;
    },
    z.date('תאריך לא תקין.').nullable(),
  ),

  stringList: z.preprocess((value) => {
    if (Array.isArray(value)) return value.map((item) => (typeof item === 'string' ? item.trim() : item)).filter(Boolean);
    if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
    return [];
  }, z.array(z.string().trim().min(1).max(160)).default([])),

  idempotencyKey: z.string().uuid(),
};
