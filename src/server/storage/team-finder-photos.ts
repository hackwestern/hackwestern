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

export const newPhotoKey = (userId: string, ext: "webp" | "jpg") =>
  `${PREFIX}${userId}/${randomUUID()}.${ext}`;

export const ownsPhotoKey = (userId: string, key: string) => {
  const prefix = `${PREFIX}${userId}/`;
  return (
    key.startsWith(prefix) &&
    /^[0-9a-f-]{36}\.(webp|jpg)$/.test(key.slice(prefix.length))
  );
};

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
