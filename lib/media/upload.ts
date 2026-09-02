import 'server-only';
import { randomUUID } from 'node:crypto';
import { AwsClient } from 'aws4fetch';
import sharp from 'sharp';

/**
 * Server-side photo upload to Cloudflare R2 (BUILD-SPEC-PR5 §2). The file
 * passes through the app — never a browser-presigned direct PUT — so `sharp`
 * can strip EXIF (including GPS) and re-encode before anything is stored.
 *
 * `aws4fetch` (~5 kB, SigV4 over `fetch`) is a `dependencies` entry, not dev:
 * the app calls it at runtime. Not `@aws-sdk/client-s3`, which is tens of
 * megabytes on a small Hostinger box that already runs `npm ci --omit=dev`.
 */

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 12;

export { MAX_UPLOAD_BYTES, MAX_GALLERY_IMAGES };

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

/** All five media env vars, required together. Mirrors `dbConfigured()`. */
export function mediaConfigured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL
  );
}

export class MediaNotConfiguredError extends Error {
  constructor() {
    super('El almacenamiento de imágenes no está configurado (faltan las variables R2_*).');
    this.name = 'MediaNotConfiguredError';
  }
}

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

function r2Config(): R2Config {
  if (!mediaConfigured()) throw new MediaNotConfiguredError();
  return {
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: process.env.R2_BUCKET!,
    publicBaseUrl: process.env.NEXT_PUBLIC_MEDIA_BASE_URL!,
  };
}

/** Magic-byte sniffing — never trust the browser's declared Content-Type. */
function sniffImageType(buf: Buffer): 'jpeg' | 'png' | 'webp' | 'avif' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('ascii', 4, 8) === 'ftyp' && buf.toString('ascii', 8, 12).startsWith('av')) return 'avif';
  return null;
}

/**
 * Accepts a `File` from `FormData`, validates it, strips EXIF, re-encodes to
 * WebP at a bounded width, and PUTs it to R2 under `listings/<listingId>/…`.
 * Returns the stored KEY, never a URL (see `lib/media/url.ts`).
 */
export async function uploadListingImage(listingId: string, file: File): Promise<string> {
  const config = r2Config();

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError('La imagen no puede superar los 10 MB.');
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(buf);
  if (!type) {
    throw new UploadValidationError('Solo se aceptan imágenes JPEG, PNG, WebP o AVIF.');
  }

  // `.rotate()` with no argument applies the EXIF orientation, then the
  // re-encode below drops the metadata entirely — that is how a GPS tag
  // leaves the file, not an explicit strip step.
  const processed = await sharp(buf)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const key = `listings/${listingId}/${randomUUID()}.webp`;
  const client = new AwsClient({ accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey });
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`;

  const res = await client.fetch(endpoint, {
    method: 'PUT',
    // The key is unique (a fresh UUID per upload), so it is safe to cache
    // forever — a new photo always gets a new key, never overwrites one.
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' },
    body: processed,
    // Bound the outbound R2 call so a stalled upstream can't pile up
    // requests toward the account-wide Hostinger process cap.
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`R2 upload failed: ${res.status} ${await res.text().catch(() => '')}`);
  }

  return key;
}
