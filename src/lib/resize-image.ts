const MAX_BYTES = 200 * 1024;

/**
 * Browser only. Centre-crops to a square and re-encodes as WebP (JPEG where
 * the browser can't encode WebP, i.e. Safari), which drops EXIF/GPS.
 */
export async function resizeToWebp(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  // Safari hands back a PNG when asked for WebP.
  let blob = await encode("image/webp");
  if (blob?.type !== "image/webp") blob = await encode("image/jpeg");
  if (blob?.type !== "image/webp" && blob?.type !== "image/jpeg") {
    throw new Error("Could not convert the image");
  }
  if (blob.size > MAX_BYTES) throw new Error("Image is too large");
  return blob;
}
