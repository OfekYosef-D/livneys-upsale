# Next steps — what to tell Livney's today

## The short version (for you)

- **The SIM / WhatsApp problem no longer blocks launch.** The platform now sends everything by **email** (order confirmation, status updates, the weekly "time to re-order" reminder, password links). WhatsApp has become an optional extra channel that can be switched on later with configuration only, no code changes.
- **Personal WhatsApp still works today:** on the admin dashboard, next to every customer who hasn't ordered for the coming delivery, there is a **"תזכורת"** button. It opens WhatsApp on the owner's own phone with a ready-written reminder and a link. No Business API or SIM needed.
- **Next step: a pilot with 3–5 customers for 2–3 weeks**, then roll out to everyone.
- What the pilot needs from them: the list below. A lawyer's approval of the terms text is the only item that hard-blocks customer orders in production.

## What changed in the system (if they ask)

1. Weekly delivery dates now roll forward automatically. Before, each route had to be updated by hand every week or ordering broke.
2. Customers see how far they are from the 700 ₪ minimum while shopping, instead of discovering it at checkout.
3. The catalog has "ordered before", "recommended for you" and "on sale" filters (the upsell part).
4. Clearer Hebrew error messages, a logout button, simpler passwords (10+ characters with a letter and a digit), correct Israeli dates and times everywhere.
5. Every admin change is recorded in an action log; the code was reorganized to be easier to maintain and extend.

## What we need from them (checklist)

| # | Item | Why |
| --- | --- | --- |
| 1 | **3–5 pilot customers**: business name, contact person, email, phone, address, which delivery route | To open their accounts |
| 2 | **Routes**: for each area, delivery day + last day/time to order | Drives the weekly schedule and reminders |
| 3 | **Products & prices** (before VAT), minimum quantity, case size, photos if available | The catalog |
| 4 | **Sender email** (e.g. `orders@livneys.co.il`) + access to the domain's DNS (or their web person) | Emails must come from their domain so they don't land in spam |
| 5 | **Lawyer approval** of the three texts in the system: commercial terms, privacy policy, cancellations | Required before real orders are accepted |
| 6 | Who on their side **approves orders** and receives customer replies (name + email) | Admin account + reply-to address |
| 7 | (Optional) a nice web address, e.g. `orders.livneys.co.il` | Instead of the default `vercel.app` address |
| 8 | Agreement on **running costs** (below) | Commercial hosting |

**Running costs (approximate, confirm before quoting):** hosting on Vercel Pro is about $20/month (the free tier isn't allowed for commercial use). The database (Neon) and email (Resend, up to ~3,000 emails/month) are free at pilot volume. WhatsApp Business messages are billed per conversation by Meta once enabled.

## WhatsApp: ways to unblock later (no rush)

- The WhatsApp Business Platform needs **one phone number that can receive a single verification SMS or voice call**. It does **not** have to be a mobile SIM: a **landline** (voice-call verification) or a **virtual number** works.
- That number must not be in use in the regular WhatsApp app at the same time.
- Then Meta business verification and approval of message templates usually take a few days. After that we flip a switch, and customers who opt in get WhatsApp updates in addition to email.

## Suggested timeline

1. **This week:** they send items 1–6, and I set up the production environment and load routes, products and prices.
2. **Next week:** internal test (an order end to end), then invite the pilot customers.
3. **2–3 weeks of pilot:** collect feedback (ease of re-ordering, reminder timing, prices), and fix things.
4. **Rollout** to all customers. WhatsApp is added whenever the number is ready.

---

## Ready-to-send message (Hebrew)

> היי [שם],
>
> עדכון לגבי פלטפורמת ההזמנות:
>
> **החדשות הטובות** – לא צריך לחכות לסים של הוואטסאפ. התאמתי את המערכת כך שכל העדכונים ללקוחות (אישור הזמנה, עדכוני סטטוס ותזכורת שבועית להזמנה חוזרת) נשלחים **במייל**. וואטסאפ עסקי יתווסף בהמשך כערוץ נוסף, בלי שינויים במערכת. בינתיים יש בלוח הבקרה כפתור ששולח ללקוח שעוד לא הזמין תזכורת אישית בוואטסאפ מהטלפון שלך, בלחיצה אחת.
>
> בנוסף עשיתי סבב שיפורים: מועדי החלוקה מתעדכנים אוטומטית כל שבוע, הלקוח רואה תוך כדי הזמנה כמה חסר לו למינימום, יש סינון "הזמנתם בעבר / מומלץ עבורכם / מבצעים", ועוד שורה של תיקונים ושיפורי אבטחה.
>
> **הצעה להמשך:** פיילוט עם 3–5 לקוחות למשך 2–3 שבועות, ואז פתיחה לכל הלקוחות.
>
> כדי להתחיל אני צריך ממך:
> 1. רשימת 3–5 לקוחות לפיילוט: שם העסק, איש קשר, מייל, טלפון, כתובת וקו חלוקה.
> 2. לכל קו חלוקה: יום החלוקה, ועד איזה יום ושעה אפשר להזמין.
> 3. רשימת מוצרים ומחירים לפני מע״מ, כמות מינימום, גודל ארגז (ותמונות אם יש).
> 4. כתובת המייל שממנה ייצאו ההודעות (למשל orders@…), וגישה להגדרות הדומיין (או פרטי מי שמנהל לכם את האתר), כדי שהמיילים לא ייכנסו לספאם.
> 5. אישור עורך דין לשלושת המסמכים שבמערכת: תנאים מסחריים, מדיניות פרטיות וביטולים. בלי זה המערכת לא מקבלת הזמנות אמיתיות.
> 6. מי אצלכם מאשר הזמנות ומקבל תשובות מלקוחות (שם ומייל).
>
> לגבי וואטסאפ בהמשך: לא חייבים סים של נייד. אפשר לחבר גם **מספר קווי** (האימות נעשה בשיחה קולית) או מספר וירטואלי, ובתנאי שהוא לא פעיל באפליקציית הוואטסאפ הרגילה.
>
> עלויות שוטפות משוערות: אחסון בערך 20$ לחודש, ומייל ובסיס נתונים בחינם בהיקף של הפיילוט.
>
> ברגע שאקבל את הפרטים, תוך כשבוע נוכל לעשות בדיקה פנימית ואז להזמין את לקוחות הפיילוט.
>
> תודה!
