import { AdminShell } from '@/components/admin/AdminShell';
import { ProductsManager } from '@/features/admin-crm/components/ProductsManager';
import { getProductManagementData } from '@/features/admin-crm/queries';
import { isCloudinaryConfigured } from '@/features/product-images/cloudinary';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireAdminPage(paths.admin.products);
  const data = await getProductManagementData();

  return (
    <AdminShell title="מוצרים" activeHref={paths.admin.products}>
      <ProductsManager data={data} imageUploadEnabled={isCloudinaryConfigured()} />
    </AdminShell>
  );
}
