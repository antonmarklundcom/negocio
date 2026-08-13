import { afterEach, describe, expect, it } from 'vitest';
import { mediaUrl } from '@/lib/media/url';

describe('mediaUrl', () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
    else process.env.NEXT_PUBLIC_MEDIA_BASE_URL = ORIGINAL;
  });

  it('passes an absolute URL through unchanged (legacy data)', () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = 'https://cdn.negocio.com.py';
    expect(mediaUrl('https://example.com/foo.jpg')).toBe('https://example.com/foo.jpg');
  });

  it('passes a root-relative seed path through unchanged', () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = 'https://cdn.negocio.com.py';
    expect(mediaUrl('/seed/food-1.svg')).toBe('/seed/food-1.svg');
  });

  it('joins a stored key with the configured base URL', () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = 'https://cdn.negocio.com.py';
    expect(mediaUrl('listings/abc/def.webp')).toBe('https://cdn.negocio.com.py/listings/abc/def.webp');
  });

  it('an unset base URL still returns a string rather than throwing', () => {
    delete process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
    expect(() => mediaUrl('listings/abc/def.webp')).not.toThrow();
    expect(typeof mediaUrl('listings/abc/def.webp')).toBe('string');
  });
});
