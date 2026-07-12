import { describe, expect, it, vi } from 'vitest';
import {
  buildCloudinarySignature,
  isCloudinaryConfigured,
  validateProductImageFile,
  uploadProductImageToCloudinary,
} from './cloudinary';

describe('Cloudinary product image upload helpers', () => {
  it('reports whether all required upload credentials are configured', () => {
    expect(isCloudinaryConfigured({
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
    })).toBe(true);
    expect(isCloudinaryConfigured({ CLOUDINARY_CLOUD_NAME: 'demo' })).toBe(false);
  });

  it('signs upload parameters with sorted keys and the API secret', () => {
    const signature = buildCloudinarySignature(
      {
        timestamp: '1315060510',
        folder: 'livneys/products',
      },
      'abcd',
    );

    expect(signature).toBe('1af56a2a946dea569587dfa02c9bff34094fc899');
  });

  it('validates product image file type and size before upload', () => {
    expect(() => validateProductImageFile(new File(['x'], 'label.pdf', { type: 'application/pdf' }))).toThrow();

    const tooLarge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' });
    expect(() => validateProductImageFile(tooLarge)).toThrow();
  });

  it('uploads image files to Cloudinary using a signed request', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/product.jpg' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await uploadProductImageToCloudinary({
      file: new File(['image'], 'product.jpg', { type: 'image/jpeg' }),
      config: {
        cloudName: 'demo',
        apiKey: 'key',
        apiSecret: 'secret',
        folder: 'livneys/products',
      },
      fetchImpl: fetchMock,
      now: () => 1234,
    });

    expect(result.secureUrl).toBe('https://res.cloudinary.com/demo/image/upload/v1/product.jpg');
    expect(fetchMock).toHaveBeenCalledWith('https://api.cloudinary.com/v1_1/demo/image/upload', expect.any(Object));
  });
});
