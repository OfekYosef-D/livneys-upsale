import { NextResponse } from 'next/server';
import { actionError } from '@/lib/action-result';
import { assertAdminAction } from '@/lib/authorization';
import { uploadProductImageToCloudinary } from '@/features/product-images/cloudinary';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await assertAdminAction();
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'לא נשלחה תמונת מוצר.' }, { status: 400 });

    const result = await uploadProductImageToCloudinary({ file });
    return NextResponse.json({ imageUrl: result.secureUrl });
  } catch (error) {
    // Same mapping as server actions: only expected (Hebrew) errors reach the browser.
    const failure = actionError(error);
    const status = failure.code === 'UNAUTHORIZED' ? 401 : failure.code === 'VALIDATION_ERROR' ? 400 : 500;
    return NextResponse.json({ error: failure.error }, { status });
  }
}
