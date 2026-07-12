import { redirect } from 'next/navigation';

export default async function Catalog(props: { params: Promise<{ customerId: string }> }) {
  const params = await props.params;
  redirect(`/customer/${params.customerId}`);
}
