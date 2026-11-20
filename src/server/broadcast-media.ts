import { env } from "~/env";

// Photos and videos for the venue broadcast display, listed from a Google
// Drive folder that organizers fill during the event. The folder must be
// shared as "Anyone with the link can view" so the display can load the files.

export type BroadcastMedia = {
  id: string;
  type: "image" | "video";
  url: string;
};

type DriveFile = { id: string; mimeType: string };

export function driveFileToMedia(file: DriveFile): BroadcastMedia | null {
  if (file.mimeType.startsWith("image/")) {
    // Google serves a resized copy of shared images (HEIC comes back as JPEG)
    return {
      id: file.id,
      type: "image",
      url: `https://lh3.googleusercontent.com/d/${file.id}=w1920`,
    };
  }
  if (file.mimeType.startsWith("video/")) {
    // Plays straight from Drive; a file Drive won't serve directly (very
    // large videos) fails to load and the display skips it.
    return {
      id: file.id,
      type: "video",
      url: `https://drive.google.com/uc?export=download&id=${file.id}`,
    };
  }
  return null;
}

const TTL_MS = 60_000;
// Every open display polls, so the listing is cached briefly per folder. If
// Google fails, the last good listing keeps being served.
const cache = new Map<string, { fetchedAt: number; media: BroadcastMedia[] }>();

export async function listFolderMedia(
  folderId: string,
): Promise<BroadcastMedia[] | null> {
  const cached = cache.get(folderId);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.media;

  try {
    const media: BroadcastMedia[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and trashed = false`,
        fields: "nextPageToken,files(id,mimeType)",
        pageSize: "1000",
        key: env.GOOGLE_SHEETS_API_KEY,
      });
      if (pageToken) params.set("pageToken", pageToken);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!response.ok) {
        throw new Error(`Drive listing failed: ${response.status}`);
      }
      const page = (await response.json()) as {
        files?: DriveFile[];
        nextPageToken?: string;
      };
      for (const file of page.files ?? []) {
        const item = driveFileToMedia(file);
        if (item) media.push(item);
      }
      pageToken = page.nextPageToken;
    } while (pageToken);

    cache.set(folderId, { fetchedAt: Date.now(), media });
    return media;
  } catch (error) {
    console.error("Broadcast media fetch failed:", error);
    return cached?.media ?? null;
  }
}
