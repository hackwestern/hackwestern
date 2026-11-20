import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { teams } from "~/server/db/schema";

export type DevpostPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
} | null;

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** Pulls the value of an og:/name meta tag out of raw HTML. */
export function metaContent(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const k = /(?:property|name)=["']([^"']+)["']/i.exec(tag)?.[1];
    if (k?.toLowerCase() !== key) continue;
    const v = /content=["']([^"']*)["']/i.exec(tag)?.[1];
    if (v) return decode(v);
  }
  return null;
}

/**
 * Title, blurb and image of a team's Devpost page. Devpost refuses to be
 * framed, so this is the closest thing to an embedded view. Only ever fetches
 * the Devpost URL stored on the team.
 */
export async function getDevpostPreview(
  teamId: string,
): Promise<DevpostPreview> {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { devpostUrl: true },
  });
  if (!team?.devpostUrl) return null;
  const parse = (raw: string) => {
    try {
      const u = new URL(raw.trim());
      if (u.protocol === "http:") u.protocol = "https:";
      const ok =
        u.protocol === "https:" &&
        (u.hostname === "devpost.com" || u.hostname.endsWith(".devpost.com"));
      return ok ? u : null;
    } catch {
      return null;
    }
  };
  const url = parse(team.devpostUrl);
  if (!url) return null;
  const empty = { url: url.href, title: null, description: null, image: null };
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; link-preview)",
        accept: "text/html",
      },
    });
    // A redirect off Devpost isn't ours to read.
    if (!res.ok || !parse(res.url)) return empty;
    const html = (await res.text()).slice(0, 400_000);
    return {
      url: url.href,
      title: metaContent(html, "og:title"),
      description:
        metaContent(html, "og:description") ?? metaContent(html, "description"),
      image: metaContent(html, "og:image"),
    };
  } catch (error) {
    console.error("Devpost preview failed", url.href, error);
    return empty;
  }
}
