import type { NextApiRequest, NextApiResponse } from "next";
import { getServerAuthSession } from "~/server/auth";
import { IncomingForm, type File, type Fields, type Files } from "formidable";
import fs from "node:fs";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_BASE_URL } from "~/server/storage/r2";

export const config = {
  api: {
    bodyParser: false, // formidable handles parsing
  },
};

const MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // common fallbacks some browsers use
  "application/octet-stream",
]);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerAuthSession({ req, res });
  if (!session?.user?.id)
    return res.status(401).json({ message: "Unauthorized" });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { file } = await parseForm(req);
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    // Type guard: ensure file has required properties
    if (
      typeof file.size !== "number" ||
      typeof file.filepath !== "string" ||
      !file.filepath
    ) {
      return res.status(400).json({ message: "Invalid file data" });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return res.status(413).json({ message: "File too large (max 3 MB)" });
    }

    // Best-effort content-type validation
    const contentType =
      typeof file.mimetype === "string"
        ? file.mimetype
        : "application/octet-stream";
    if (!ALLOWED_MIME.has(contentType)) {
      // allow pdf or doc/docx or octet-stream when unknown
      return res.status(415).json({ message: "Unsupported file type" });
    }

    const userId = session.user.id;
    const originalName =
      typeof file.originalFilename === "string" && file.originalFilename
        ? file.originalFilename
        : "resume.pdf";

    // sanitize original filename to remove problematic characters
    const sanitize = (name: string) =>
      name
        .replace(/\s+/g, "-") // spaces to dashes
        .replace(/[^a-zA-Z0-9._-]/g, "") // remove unsafe chars
        .replace(/^-+|-+$/g, "") // trim leading/trailing dashes
        .slice(0, 200); // limit length

    const safeName = sanitize(originalName);
    // Use the sanitized original filename as the stored object name so the
    // URL preserves the original file name. This will overwrite an existing
    // object with the same filename for this user; acceptable for resume
    // re-uploads.
    const objectKey = `resumes/${userId}/${safeName}`;

    // Upload to R2
    const fileStream = fs.createReadStream(file.filepath);
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: objectKey,
        Body: fileStream,
        ContentType: contentType,
      }),
    );

    const url = `${R2_PUBLIC_BASE_URL}/${objectKey}`;

    return res.status(200).json({
      url,
      key: objectKey,
      name: originalName,
      size: file.size,
      contentType,
    });
  } catch (err) {
    console.error("Resume upload failed", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

function parseForm(req: NextApiRequest): Promise<{ file: File | undefined }> {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      maxFileSize: MAX_SIZE_BYTES,
      multiples: false,
      keepExtensions: true,
    });

    form.parse(req, (err: Error | null, _fields: Fields, files: Files) => {
      if (err) return reject(err);

      // Try multiple field names
      const fileField = files.file ?? files.resume ?? files.upload;

      if (!fileField) {
        return resolve({ file: undefined });
      }

      // Handle both single file and array
      const singleFile = Array.isArray(fileField) ? fileField[0] : fileField;
      resolve({ file: singleFile });
    });
  });
}
