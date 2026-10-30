import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

const PREFIX = "team-finder/";
const GET_EXPIRES_SECONDS = 60 * 60;

// No user id in the key: photo links reach other hackers, and the user id is
// the hacker pass QR payload. A photo belongs to whoever's row holds its key.
export const newPhotoKey = (ext: "webp" | "jpg") =>
  `${PREFIX}${randomUUID()}.${ext}`;

/** Photos need the private bucket's three env vars. */
export const photosConfigured = () =>
  !!(
    env.TEAM_FINDER_R2_BUCKET &&
    env.TEAM_FINDER_R2_ACCESS_KEY_ID &&
    env.TEAM_FINDER_R2_SECRET_ACCESS_KEY
  );

let client: S3Client | undefined;
function photoClient() {
  client ??= new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.TEAM_FINDER_R2_ACCESS_KEY_ID!,
      secretAccessKey: env.TEAM_FINDER_R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

export async function putPhoto(
  key: string,
  bytes: Uint8Array,
  contentType: "image/webp" | "image/jpeg",
) {
  await photoClient().send(
    new PutObjectCommand({
      Bucket: env.TEAM_FINDER_R2_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );
}

export function presignPhotoGet(key: string) {
  return getSignedUrl(
    photoClient(),
    new GetObjectCommand({ Bucket: env.TEAM_FINDER_R2_BUCKET, Key: key }),
    { expiresIn: GET_EXPIRES_SECONDS },
  );
}

export async function deletePhoto(key: string) {
  if (!key.startsWith(PREFIX)) {
    throw new Error("Refusing to delete a key outside team-finder/");
  }
  await photoClient().send(
    new DeleteObjectCommand({ Bucket: env.TEAM_FINDER_R2_BUCKET, Key: key }),
  );
}
