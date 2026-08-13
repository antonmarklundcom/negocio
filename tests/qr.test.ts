import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { listingQrSvg } from '@/lib/media/qr';

describe('listingQrSvg', () => {
  it('renders a plain SVG document for a listing URL', async () => {
    const svg = await listingQrSvg('https://negocio.com.py/lugar/nande-cocina');
    expect(svg.trim().startsWith('<svg')).toBe(true);
    expect(svg).not.toContain('<script');
  });

  it('produces a different code for a different URL', async () => {
    const a = await listingQrSvg('https://negocio.com.py/lugar/a');
    const b = await listingQrSvg('https://negocio.com.py/lugar/b');
    expect(a).not.toBe(b);
  });
});
