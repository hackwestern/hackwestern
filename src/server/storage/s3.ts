import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "~/env";

const s3Client = new S3Client({
  region: env.SERVER_S3_REGION ?? "auto",
  endpoint: env.SERVER_S3_ENDPOINT ?? undefined,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.SERVER_S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.SERVER_S3_SECRET_ACCESS_KEY ?? "",
  },
});

export async function uploadResume({
  key,
  buffer,
  contentType,
}: {
  key: string;
  buffer: Buffer;
  contentType: string;
}) {
  const bucket = env.SERVER_S3_BUCKET_NAME;

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // Do not send ACL; R2 doesn't support ACLs the same way as AWS S3. Make bucket public via R2 settings or serve via a gateway.
  });

  await s3Client.send(cmd);

  // If a custom endpoint is provided, construct URL using it, otherwise use standard S3 URL
  if (env.SERVER_S3_ENDPOINT) {
    // Ensure no trailing slash
    const endpoint = env.SERVER_S3_ENDPOINT.replace(/\/$/, "");
    return `${endpoint}/${bucket}/${encodeURIComponent(key)}`;
  }

  return `https://${bucket}.s3.${env.SERVER_S3_REGION}.amazonaws.com/${encodeURIComponent(
    key,
  )}`;
}
