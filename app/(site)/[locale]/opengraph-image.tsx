import { ImageResponse } from 'next/og';

/**
 * Default social-share card (og:image + twitter:image). Auto-applied site-wide;
 * individual pages can still override via their own metadata. Matters a lot for
 * a directory whose links get shared on WhatsApp/Facebook.
 */
export const runtime = 'nodejs';
export const alt = 'negocio.com.py — Encontrá negocios en Paraguay';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(150deg, #FBF6EC, #F2E7D6)',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 600, color: '#241E16' }}>
          negocio<span style={{ color: '#C2643E' }}>.com.py</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 68, fontWeight: 700, color: '#241E16', lineHeight: 1.1, maxWidth: 900 }}>
          Encontrá negocios de confianza cerca tuyo.
        </div>
        <div style={{ marginTop: 24, fontSize: 32, color: '#5B5246' }}>
          Restaurantes, tiendas, servicios y profesionales en todo Paraguay.
        </div>
      </div>
    ),
    { ...size },
  );
}
