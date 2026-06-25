import { redirect } from 'next/navigation';

export default function Catalog({ params }: { params: { customerId: string } }) {
  redirect(`/customer/${params.customerId}`);
}
