import { Button } from '@/components/ui/Button';
import { getCustomerPortalData } from '@/features/customer-portal/queries';
import { hebDate } from '@/lib/format';
import { requireCustomerPage } from '@/lib/authorization';

export const dynamic = 'force-dynamic';

export default async function Reminder({ params }: { params: { customerId: string } }) {
  await requireCustomerPage(params.customerId);
  const data = await getCustomerPortalData(params.customerId);

  return (
    <main className="app-surface min-h-screen px-4 py-6 text-black">
      <section className="mx-auto max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.08)]">
        <p className="text-sm text-black/50">הודעה ל{data.customer.contact}</p>
        <h1 className="mt-2 text-2xl font-black">
          <b>{data.customer.name}, קו {data.route.name} מתקרב.</b>
        </h1>
        <p className="mt-4 text-base leading-7">
          החלוקה הקרובה: {hebDate(data.route.nextDelivery)}.
          <br />
          נא להשלים הזמנה עד {data.route.deadline}.
        </p>
        <Button href={`/customer/${data.customer.id}`} className="mt-5 w-full">
          לפתיחת הזמנה חוזרת
        </Button>
      </section>
    </main>
  );
}
