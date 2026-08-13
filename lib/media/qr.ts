import 'server-only';
import QRCode from 'qrcode';

/**
 * QR code for a listing's public profile (ROADMAP Phase D item 4) —
 * printable sticker → `/lugar/[slug]`. `qrcode` is pure JS (no native
 * bindings), which matters on Hostinger's small box exactly like the
 * `sharp`/`aws4fetch` choices elsewhere.
 */
export async function listingQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#161311', light: '#FFFFFF' },
  });
}
