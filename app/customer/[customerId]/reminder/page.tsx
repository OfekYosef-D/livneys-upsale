import { PageShell } from '@/components/ui/PageShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getCustomer, getRoute, hebDate } from '@/lib/mock-data';

export default function Reminder({ params }: { params: { customerId: string } }) {
  const customer = getCustomer(params.customerId);
  const route = getRoute(customer.routeId);

  return (
    <PageShell title="תצוגת תזכורת ללקוח" subtitle="דמו להודעת SMS/Email — ללא אינטגרציה אמיתית">
      <Card className="mx-auto max-w-md p-5">
        <p className="text-sm text-black/50">הודעה ל{customer.contact}</p>
        <div className="mt-3 rounded-2xl bg-[#e6e1d8] p-4 leading-8">
          <b>{customer.name}, קו {customer.region} מתקרב.</b>
          <br />
          החלוקה הקרובה: {hebDate(route.nextDelivery)}.
          <br />
          נא להשלים הזמנה עד {route.deadline}.
          <br />
          הקישור האישי שלך מוכן להזמנה חוזרת מהירה.
        </div>
        <Button href={`/customer/${customer.id}`} className="mt-5 w-full">
          פתח קישור אישי
        </Button>
      </Card>
    </PageShell>
  );
}
