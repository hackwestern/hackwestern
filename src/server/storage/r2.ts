import { S3Client } from "@aws-sdk/client-s3";
import { env } from "~/env";

// Shared S3 client configured for Cloudflare R2 (S3-compatible)
export const r2Client = new S3Client({
  region: "auto", // Cloudflare R2 uses 'auto'
  endpoint: env.R2_ENDPOINT,
  forcePathStyle: true, // R2 prefers path-style
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export const R2_BUCKET = env.R2_BUCKET_NAME;
export const R2_PUBLIC_BASE_URL = env.R2_PUBLIC_BASE_URL.replace(/\/$/, "");
