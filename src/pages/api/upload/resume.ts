import type { NextApiRequest, NextApiResponse } from "next";
import { getServerAuthSession } from "~/server/auth";
import formidable from "formidable";
import fs from "fs";
import { uploadResume } from "~/server/storage/s3";
import { v4 as uuidv4 } from "uuid";

// Disable Next's default bodyParser so formidable can handle multipart
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerAuthSession({ req, res });
  if (!session || !session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const form = new formidable.IncomingForm();

  form.parse(req, (err: unknown, fields: formidable.Fields, files: formidable.Files) => {
    // Wrap async work in an IIFE so the callback itself is not async (avoids returning Promise in a void callback)
    (async () => {
      try {
        if (err) {
          console.error("Form parse error", err);
          return res.status(400).json({ message: "Failed to parse form" });
        }

        const file = files?.file as formidable.File | formidable.File[] | undefined;
        const singleFile = Array.isArray(file) ? file[0] : file;
        if (!singleFile) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const buffer = fs.readFileSync(singleFile.filepath);
        const ext = (singleFile.originalFilename ?? singleFile.newFilename ?? "").split(".").pop();
        const key = `resumes/${session.user.id}/${uuidv4()}${ext ? `.${ext}` : ""}`;

        const url = await uploadResume({
          key,
          buffer,
          contentType: singleFile.mimetype ?? "application/octet-stream",
        });

        return res.status(200).json({ url });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Upload failed" });
      }
    })().catch((e) => {
      console.error("Unexpected error in upload handler", e);
      if (!res.headersSent) res.status(500).json({ message: "Upload failed" });
    });
  });
}
