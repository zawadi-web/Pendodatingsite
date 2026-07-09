/**
 * Pendo Image Storage
 * ───────────────────
 * Supports three backends, selected via STORAGE_PROVIDER env var:
 *
 *   'local'      → public/uploads/ (development only — NOT for production)
 *   'cloudinary' → Cloudinary free tier (recommended for production)
 *   'r2' / 's3'  → Cloudflare R2 or AWS S3
 *
 * Cloudinary setup (free, 25GB/month):
 *   1. Create account at https://cloudinary.com
 *   2. Dashboard → Settings → API Keys → Copy name, key, secret
 *   3. Add to .env:
 *        STORAGE_PROVIDER=cloudinary
 *        CLOUDINARY_CLOUD_NAME=your_cloud_name
 *        CLOUDINARY_API_KEY=your_api_key
 *        CLOUDINARY_API_SECRET=your_api_secret
 *
 * R2/S3 setup:
 *   STORAGE_PROVIDER=r2
 *   STORAGE_BUCKET_NAME=...
 *   STORAGE_ENDPOINT=...   (R2: https://<account_id>.r2.cloudflarestorage.com)
 *   STORAGE_ACCESS_KEY_ID=...
 *   STORAGE_SECRET_ACCESS_KEY=...
 *   STORAGE_PUBLIC_URL=...  (your R2 public domain)
 */

import fs from 'fs/promises';
import path from 'path';

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';

// ── Cloudinary ──────────────────────────────────────────────────────────────
let cloudinary: any = null;

if (STORAGE_PROVIDER === 'cloudinary') {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn(
      '[Storage] STORAGE_PROVIDER=cloudinary but credentials are missing. ' +
      'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env. ' +
      'Falling back to local storage.'
    );
  } else {
    // Lazy import — only require cloudinary when actually configured
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { v2 } = require('cloudinary');
    v2.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    cloudinary = v2;
    console.log('[Storage] Cloudinary configured ✓');
  }
}

// ── S3 / R2 ─────────────────────────────────────────────────────────────────
let s3Client: any = null;
const STORAGE_BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || '';
const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT || '';
const STORAGE_ACCESS_KEY_ID = process.env.STORAGE_ACCESS_KEY_ID || '';
const STORAGE_SECRET_ACCESS_KEY = process.env.STORAGE_SECRET_ACCESS_KEY || '';
const STORAGE_PUBLIC_URL = process.env.STORAGE_PUBLIC_URL || '';

if ((STORAGE_PROVIDER === 'r2' || STORAGE_PROVIDER === 's3') && STORAGE_BUCKET_NAME && STORAGE_ACCESS_KEY_ID) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { S3Client } = require('@aws-sdk/client-s3');
  s3Client = new S3Client({
    region: 'auto',
    endpoint: STORAGE_ENDPOINT || undefined,
    credentials: {
      accessKeyId: STORAGE_ACCESS_KEY_ID,
      secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
    },
  });
  console.log(`[Storage] ${STORAGE_PROVIDER.toUpperCase()} configured ✓`);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Uploads an image buffer and returns its public URL.
 * In production, images go to Cloudinary/R2/S3 — NEVER stored as blobs in the DB.
 */
export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  userId: string
): Promise<string> {
  const sanitized = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
  const uniqueName = `pendo/${userId}_${Date.now()}_${sanitized}`;

  // 1. Cloudinary — use callback API (works reliably with cloudinary v2.x)
  if (cloudinary) {
    try {
      const result = await new Promise<any>((resolve, reject) => {
        // Convert buffer to base64 data URI so we can use the simpler upload() API
        const b64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
        cloudinary.uploader.upload(
          b64,
          {
            folder: 'pendo-profiles',
            public_id: `${userId}_${Date.now()}`,
            resource_type: 'image',
            format: 'webp',          // auto-convert to WebP — 50-80% smaller
            quality: 'auto:good',    // smart compression
            transformation: [{ width: 1200, crop: 'limit' }],
          },
          (error: any, res: any) => {
            if (error) reject(error);
            else resolve(res);
          }
        );
      });
      return result.secure_url;  // HTTPS Cloudinary CDN URL
    } catch (err) {
      console.error('[Storage] Cloudinary upload failed, falling back to local:', err);
    }
  }

  // 2. S3 / R2
  if (s3Client) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      await s3Client.send(
        new PutObjectCommand({
          Bucket: STORAGE_BUCKET_NAME,
          Key: uniqueName,
          Body: buffer,
          ContentType: mimeType,
        })
      );
      const base = STORAGE_PUBLIC_URL
        ? (STORAGE_PUBLIC_URL.endsWith('/') ? STORAGE_PUBLIC_URL : `${STORAGE_PUBLIC_URL}/`)
        : `${STORAGE_ENDPOINT}/${STORAGE_BUCKET_NAME}/`;
      return `${base}${uniqueName}`;
    } catch (err) {
      console.error('[Storage] R2/S3 upload failed, falling back to local:', err);
    }
  }

  // 3. Local fallback (dev only)
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  const localName = `${userId}_${Date.now()}_${sanitized}`;
  await fs.writeFile(path.join(uploadDir, localName), buffer);
  console.warn('[Storage] Using local filesystem. Set STORAGE_PROVIDER=cloudinary for production.');
  return `/uploads/${localName}`;
}
