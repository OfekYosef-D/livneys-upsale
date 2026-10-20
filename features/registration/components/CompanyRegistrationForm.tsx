'use client';

import Image from 'next/image';
import Script from 'next/script';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { formValue, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { formatMoney } from '@/lib/money';
import { brandLogo } from '@/lib/product-assets';
import { institutionalBusinessTypes, MINIMUM_INSTITUTIONAL_ORDER_TOTAL } from '../../owner-rules/constants';
import { createCompanyRegistrationAction } from '../actions';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type TurnstileWindow = Window & { turnstile?: { reset: () => void } };

/** Public "open a business account" form. The team reviews each request before access is granted. */
export function CompanyRegistrationForm() {
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => formValue.text(form, name);
    setPending(true);
    setError(null);

    const result = await createCompanyRegistrationAction({
      businessName: text('businessName'),
      invoiceName: text('invoiceName'),
      contactName: text('contactName'),
      phone: text('phone'),
      email: text('email'),
      accountingContactName: text('accountingContactName'),
      accountingEmail: text('accountingEmail'),
      accountingPhone: text('accountingPhone'),
      businessType: text('businessType'),
      address: text('address'),
      deliveryNotes: text('deliveryNotes'),
      openingOrderNotes: text('openingOrderNotes'),
      website: text('website'),
      challengeToken: text('cf-turnstile-response'),
    });

    setPending(false);
    if (result.ok) {
      setSubmitted(true);
      return;
    }
    setError(result.error);
    (window as TurnstileWindow).turnstile?.reset();
  }

  return (
    <main className="app-surface min-h-screen px-3 py-6 text-black md:px-6">
      <section className="ui-panel mx-auto max-w-2xl p-5">
        <Image src={brandLogo} alt="ליבני'ס" className="w-24" priority />
        <h1 className="mt-5 text-xl font-semibold">פתיחת חשבון לעסקים</h1>
        <p className="mt-1 text-sm leading-6 text-black/60">
          משאירים פרטים, ואנחנו חוזרים אליכם לתיאום קו חלוקה ומחירון. לאחר האישור יישלח אליכם במייל קישור לכניסה.
        </p>
        <p className="mt-2 text-xs text-black/50">מינימום הזמנה {formatMoney(MINIMUM_INSTITUTIONAL_ORDER_TOTAL)} לפני מע״מ.</p>

        {submitted ? (
          <Notice tone="success" icon={<CheckCircle2 size={18} />} title="הבקשה התקבלה!" className="mt-5">
            נחזור אליכם בהקדם. <a href="/login" className="font-semibold underline">חזרה לכניסה</a>
          </Notice>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField name="businessName" label="שם העסק" required autoComplete="organization" />
              <SelectField
                name="businessType"
                label="סוג העסק"
                required
                defaultValue=""
                options={[{ value: '', label: 'בחרו…' }, ...institutionalBusinessTypes.map((type) => ({ value: type, label: type })), { value: 'אחר', label: 'אחר' }]}
              />
              <TextField name="contactName" label="איש קשר להזמנות" required autoComplete="name" />
              <TextField name="phone" label="טלפון" type="tel" dir="ltr" required autoComplete="tel" />
              <TextField name="email" label="אימייל (לכניסה למערכת)" type="email" dir="ltr" required autoComplete="email" />
              <TextField name="invoiceName" label="שם לחשבונית (לא חובה)" />
            </div>
            <TextField name="address" label="כתובת למשלוח" required autoComplete="street-address" />

            <details className="rounded-md border border-[var(--pantry-line)] p-3">
              <summary className="cursor-pointer text-sm font-semibold">פרטי הנהלת חשבונות (לא חובה)</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <TextField name="accountingContactName" label="איש קשר" />
                <TextField name="accountingEmail" label="אימייל" type="email" dir="ltr" />
                <TextField name="accountingPhone" label="טלפון" type="tel" dir="ltr" />
              </div>
            </details>

            <div className="grid gap-3 md:grid-cols-2">
              <TextAreaField name="deliveryNotes" label="מתי נוח לקבל משלוחים?" placeholder="ימים ושעות, הוראות כניסה" />
              <TextAreaField name="openingOrderNotes" label="משהו שחשוב לנו לדעת?" placeholder="מוצרים שמעניינים אתכם, שאלות" />
            </div>

            {/* Honeypot for bots: hidden from people and assistive technology. */}
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-px w-px opacity-0" />
            {TURNSTILE_SITE_KEY && (
              <>
                <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
                <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-language="he" />
              </>
            )}

            {error && <Notice tone="danger">{error}</Notice>}
            <Button type="submit" size="lg" pending={pending} pendingLabel="שולחים…">
              שליחת הבקשה <ArrowLeft size={16} aria-hidden="true" />
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
