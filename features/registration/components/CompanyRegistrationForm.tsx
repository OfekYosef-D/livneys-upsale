'use client';

import Image from 'next/image';
import { ArrowLeft, Building2, CheckCircle2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { createCompanyRegistrationAction } from '@/features/registration/actions';
import { institutionalBusinessTypes, MINIMUM_INSTITUTIONAL_ORDER_TOTAL, PRICES_BEFORE_VAT_LABEL } from '@/features/owner-rules/constants';
import { brand } from '@/lib/brand';
import { brandLogo } from '@/lib/product-assets';

export function CompanyRegistrationForm() {
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <main className="app-surface min-h-screen px-3 py-4 text-black md:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_55px_rgba(0,0,0,0.07)] md:p-5">
          <div className="flex items-center justify-between gap-4">
            <Image src={brandLogo} alt={brand.hebrewName} className="w-28" priority />
            <span className="rounded-full bg-[#e6e1d8] px-3 py-1 text-xs font-black">B2B</span>
          </div>

          <div className="mt-5">
            <p className="text-xs font-black text-black/50">הרשמה ללקוחות מוסדיים</p>
            <h1 className="mt-1 text-2xl font-black leading-tight md:text-3xl">פותחים לקוח עסקי חדש</h1>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-black/62">
              משאירים פרטים, צוות ליבני&apos;ס בודק קו חלוקה ומחירון, ואז פותח לכם גישה להזמנות.
            </p>
          </div>

          {submitted ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <CheckCircle2 size={28} />
              <h2 className="mt-2 text-xl font-black">הבקשה נשלחה</h2>
              <p className="mt-1 text-sm font-bold leading-6">הצוות קיבל את הפרטים ויחזור אליכם לפני פתיחת החשבון.</p>
              <Button href="/login" className="mt-4">חזרה לכניסה <ArrowLeft size={16} /></Button>
            </div>
          ) : (
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setMessage('');
                const form = new FormData(event.currentTarget);

                startTransition(async () => {
                  const result = await createCompanyRegistrationAction({
                    businessName: stringValue(form, 'businessName'),
                    invoiceName: stringValue(form, 'invoiceName'),
                    contactName: stringValue(form, 'contactName'),
                    phone: stringValue(form, 'phone'),
                    email: stringValue(form, 'email'),
                    accountingContactName: stringValue(form, 'accountingContactName'),
                    accountingEmail: stringValue(form, 'accountingEmail'),
                    accountingPhone: stringValue(form, 'accountingPhone'),
                    businessType: stringValue(form, 'businessType'),
                    address: stringValue(form, 'address'),
                    deliveryNotes: stringValue(form, 'deliveryNotes'),
                    openingOrderNotes: stringValue(form, 'openingOrderNotes'),
                  });

                  if (result.ok) {
                    setSubmitted(true);
                  } else {
                    setMessage(result.error);
                  }
                });
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Input name="businessName" label="שם העסק" required autoComplete="organization" />
                <Input name="invoiceName" label="שם לחשבונית" autoComplete="organization" />
                <Input name="contactName" label="איש קשר להזמנות" required autoComplete="name" />
                <Input name="phone" label="טלפון" required type="tel" autoComplete="tel" />
                <Input name="email" label="מייל להתחברות" required type="email" autoComplete="email" />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black">סוג עסק</span>
                  <select name="businessType" required className={fieldClass} defaultValue="">
                    <option value="" disabled>בחרו סוג עסק</option>
                    {institutionalBusinessTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
              </div>

              <Input name="address" label="כתובת העסק" required autoComplete="street-address" />

              <section className="rounded-2xl border border-black/10 p-3">
                <h2 className="text-sm font-black">הנהלת חשבונות</h2>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Input name="accountingContactName" label="איש קשר" />
                  <Input name="accountingEmail" label="מייל" type="email" />
                  <Input name="accountingPhone" label="טלפון" type="tel" />
                </div>
              </section>

              <div className="grid gap-3 md:grid-cols-2">
                <Textarea name="deliveryNotes" label="אילוצי חלוקה" placeholder="ימים שלא פתוחים, ימים שאסור להגיע, שעות אספקה נוחות" />
                <Textarea name="openingOrderNotes" label="מידע להזמנה ראשונה" placeholder="טעימות, טעמים מועדפים, שאלות פתוחות" />
              </div>

              {message && <p className="rounded-xl bg-[#e6e1d8] p-3 text-sm font-black text-red-700">{message}</p>}

              <button type="submit" disabled={isPending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white disabled:bg-black/30 md:w-auto">
                {isPending ? 'שולחים...' : 'שליחת בקשת הרשמה'}
                <ArrowLeft size={16} />
              </button>
            </form>
          )}
        </section>

        <aside className="space-y-3 rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_55px_rgba(0,0,0,0.05)]">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e6e1d8]">
            <Building2 size={22} />
          </div>
          <h2 className="text-xl font-black">מה חשוב לדעת</h2>
          <div className="space-y-2 text-sm font-bold leading-6 text-black/62">
            <p>מינימום הזמנה מוסדית: {MINIMUM_INSTITUTIONAL_ORDER_TOTAL} ₪.</p>
            <p>{PRICES_BEFORE_VAT_LABEL}. המחירון באתר מיועד ללקוחות מוסדיים בלבד.</p>
            <p>הכמויות נקבעות לפי ארגזים, ולכן הצוות עשוי לעדכן כמות לפני אישור סופי.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Input({ name, label, required = false, type = 'text', autoComplete }: { name: string; label: string; required?: boolean; type?: string; autoComplete?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black">{label}</span>
      <input name={name} type={type} required={required} autoComplete={autoComplete} className={fieldClass} />
    </label>
  );
}

function Textarea({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black">{label}</span>
      <textarea name={name} placeholder={placeholder} rows={4} className={`${fieldClass} min-h-24 resize-y`} />
    </label>
  );
}

function stringValue(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

const fieldClass = 'w-full rounded-xl border border-black/12 bg-white px-3 py-2.5 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-black/25';
