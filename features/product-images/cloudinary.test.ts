import { describe, expect, it, vi } from 'vitest';
import {
  buildCloudinarySignature,
  getCloudinaryConfig,
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
    expect(() => validateProductImageFile(new File(['x'], 'label.pdf', { type: 'application/pdf' }))).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );

    const tooLarge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' });
    expect(() => validateProductImageFile(tooLarge)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('returns a safe configuration error when image upload is unavailable', () => {
    expect(() => getCloudinaryConfig({} as NodeJS.ProcessEnv)).toThrow(
      expect.objectContaining({ code: 'DELIVERY_UNAVAILABLE', message: 'העלאת תמונות אינה מוגדרת כרגע.' }),
    );
  });

  it('trims credentials and defaults the product folder', () => {
    expect(getCloudinaryConfig({
      CLOUDINARY_CLOUD_NAME: ' demo ', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret',
    } as unknown as NodeJS.ProcessEnv)).toEqual({ cloudName: 'demo', apiKey: 'key', apiSecret: 'secret', folder: 'livneys/products' });
  });

  it('surfaces a provider rejection and a missing image URL as errors', async () => {
    const config = { cloudName: 'demo', apiKey: 'key', apiSecret: 'secret' };
    const file = new File(['image'], 'product.png', { type: 'image/png' });
    await expect(uploadProductImageToCloudinary({
      file, config, fetchImpl: vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Invalid signature' } }), { status: 401 })),
    })).rejects.toThrow('Invalid signature');
    await expect(uploadProductImageToCloudinary({
      file, config, fetchImpl: vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    })).rejects.toThrow('Cloudinary did not return an image URL.');
  });

  it('never uploads a rejected file type', async () => {
    const fetchMock = vi.fn();
    await expect(uploadProductImageToCloudinary({
      file: new File(['x'], 'doc.pdf', { type: 'application/pdf' }),
      config: { cloudName: 'demo', apiKey: 'key', apiSecret: 'secret' },
      fetchImpl: fetchMock,
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(fetchMock).not.toHaveBeenCalled();
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
    const form = (fetchMock.mock.calls[0] as unknown as [string, { body: FormData }])[1].body;
    expect(form.get('api_key')).toBe('key');
    expect(form.get('timestamp')).toBe('1234');
    expect(form.get('folder')).toBe('livneys/products');
    expect(form.get('signature')).toBe(buildCloudinarySignature({ timestamp: '1234', folder: 'livneys/products' }, 'secret'));
    expect(form.get('api_secret')).toBeNull();
  });
});
