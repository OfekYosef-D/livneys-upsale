import { NextResponse } from 'next/server';
import { uploadProductImageToCloudinary } from '@/features/product-images/cloudinary';
import { assertAdminAction, AuthorizationError } from '@/lib/authorization';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await assertAdminAction();

    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'לא נשלחה תמונת מוצר.' }, { status: 400 });
    }

    const result = await uploadProductImageToCloudinary({ file });
    return NextResponse.json({ imageUrl: result.secureUrl });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'אירעה שגיאה בהעלאת תמונת המוצר.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
