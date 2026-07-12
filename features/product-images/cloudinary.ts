import crypto from 'node:crypto';

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder?: string;
};

export type ProductImageUploadResult = {
  secureUrl: string;
};

export function isCloudinaryConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME?.trim()
    && env.CLOUDINARY_API_KEY?.trim()
    && env.CLOUDINARY_API_SECRET?.trim(),
  );
}

export function getCloudinaryConfig(env: NodeJS.ProcessEnv = process.env): CloudinaryConfig {
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  const folder = env.CLOUDINARY_PRODUCT_FOLDER?.trim() || 'livneys/products';

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary image upload is not configured.');
  }

  return { cloudName, apiKey, apiSecret, folder };
}

export function validateProductImageFile(file: File) {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error('יש להעלות קובץ תמונה בלבד: JPG, PNG, WebP או GIF.');
  }

  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error('תמונת מוצר יכולה להיות עד 5MB.');
  }
}

export function buildCloudinarySignature(params: Record<string, string>, apiSecret: string): string {
  const serialized = Object.entries(params)
    .filter(([, value]) => value.length > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return crypto.createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex');
}

export async function uploadProductImageToCloudinary({
  file,
  config = getCloudinaryConfig(),
  fetchImpl = fetch,
  now = () => Math.floor(Date.now() / 1000),
}: {
  file: File;
  config?: CloudinaryConfig;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<ProductImageUploadResult> {
  validateProductImageFile(file);

  const timestamp = String(now());
  const signedParams: Record<string, string> = { timestamp };
  if (config.folder) {
    signedParams.folder = config.folder;
  }

  const form = new FormData();
  form.set('file', file);
  form.set('api_key', config.apiKey);
  form.set('timestamp', timestamp);
  form.set('signature', buildCloudinarySignature(signedParams, config.apiSecret));
  if (config.folder) {
    form.set('folder', config.folder);
  }

  const response = await fetchImpl(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });

  const payload = await response.json().catch(() => null) as { secure_url?: unknown; error?: { message?: string } } | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Cloudinary image upload failed.');
  }

  if (!payload || typeof payload.secure_url !== 'string') {
    throw new Error('Cloudinary did not return an image URL.');
  }

  return { secureUrl: payload.secure_url };
}
