import { type NextApiRequest, type NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { url } = req.query;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing or invalid url parameter" });
  }

  try {
    const imageRes = await fetch(url);

    if (!imageRes.ok) {
      return res.status(imageRes.status).send("Failed to fetch image");
    }

    const contentType = imageRes.headers.get("content-type");
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Cache heavily on the CDN and browser for 1 day, stale-while-revalidate for 1 week
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    );

    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Avatar proxy error:", error);
    return res.status(500).json({ error: "Internal error fetching avatar" });
  }
}
