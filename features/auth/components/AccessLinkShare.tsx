'use client';

import { Check, Copy, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { buttonClassName, Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { buildWhatsAppUrl } from '@/lib/whatsapp-link';
import { accessLinkValidity, buildAccessLinkMessage } from '../access-link';
import type { AccountAccessLink } from '../notifications';

/** A freshly issued one-time account link, ready to send from the team member's own WhatsApp. */
export function AccessLinkShare({ link, contact, phone }: { link: AccountAccessLink; contact: string; phone: string | null }) {
  const [copied, setCopied] = useState(false);
  const message = buildAccessLinkMessage({ contact, url: link.url, type: link.type });

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Notice tone="success" title={link.emailed ? 'הקישור נשלח במייל. אפשר לשלוח אותו גם בוואטסאפ:' : 'הקישור מוכן – שלחו אותו ללקוח:'}>
      <p className="text-xs">קישור אישי, תקף ל-{accessLinkValidity[link.type]} ולשימוש פעם אחת. אל תעבירו אותו לאחרים.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <a href={buildWhatsAppUrl(phone, message)} target="_blank" rel="noreferrer" className={buttonClassName({ size: 'sm' })}>
          <MessageCircle size={14} aria-hidden="true" /> שליחה בוואטסאפ
        </a>
        <Button size="sm" variant="outline" onClick={copy} icon={copied ? <Check size={14} /> : <Copy size={14} />}>
          {copied ? 'הועתק' : 'העתקת ההודעה'}
        </Button>
      </div>
    </Notice>
  );
}
