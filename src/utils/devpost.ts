/**
 * Scraping helpers for DevPost project pages.
 *
 * DevPost has no public API for a submission, so the "Built With" tags are read
 * straight out of the page HTML. Kept free of any `~/server/db` import so it
 * stays a pure fetch/parse module, like `~/utils/github`; the piece that writes
 * to a team row lives in `~/server/api/utils/tech-stack`.
 */

const USER_AGENT =
  "Mozilla/5.0 (compatible; HackWesternTechStack/1.0; +https://hackwestern.com)";

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Thrown when a DevPost URL is unusable or the page can't be read. Callers that
 * scrape many teams in a row catch this per team rather than failing the batch.
 */
export class DevpostScrapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DevpostScrapeError";
  }
}

/**
 * Strips a DevPost project URL down to `https://devpost.com/software/<slug>`.
 */
export function normalizeDevpostUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new DevpostScrapeError("No DevPost URL provided");
  }

  let url: URL;
  try {
    url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
  } catch {
    throw new DevpostScrapeError(`Not a valid URL: ${input}`);
  }

  const host = url.hostname.toLowerCase();
  if (host !== "devpost.com" && !host.endsWith(".devpost.com")) {
    throw new DevpostScrapeError(`Not a DevPost URL: ${input}`);
  }

  // ["", "software", "<slug>", ...rest]
  const segments = url.pathname.split("/");
  if (segments[1] !== "software" || !segments[2]) {
    throw new DevpostScrapeError(`Not a DevPost project URL: ${input}`);
  }

  return `https://devpost.com/software/${segments[2]}`;
}

function decodeCodePoint(literal: string, raw: string, radix: number): string {
  const code = parseInt(raw, radix);
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return literal;
  return String.fromCodePoint(code);
}

/** Decodes the handful of HTML entities that show up in tag text (`C#`, `AT&T`). */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (match: string, code: string) =>
      decodeCodePoint(match, code, 10),
    )
    .replace(/&#x([0-9a-f]+);/gi, (match: string, code: string) =>
      decodeCodePoint(match, code, 16),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * Pulls the "Built With" tags out of a DevPost project page's HTML.
 *
 * Returns tags in page order (DevPost sorts them alphabetically), deduplicated
 * case-insensitively. A project with no technologies listed yields `[]`.
 */
export function parseBuiltWith(html: string): string[] {
  const section = /<div[^>]+id="built-with"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
  if (!section?.[1]) return [];

  const tags: string[] = [];
  const seen = new Set<string>();
  const tagRegex =
    /<span[^>]*class="[^"]*\bcp-tag\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(section[1])) !== null) {
    const label = decodeEntities(match[1]!.replace(/<[^>]*>/g, ""))
      .replace(/\s+/g, " ")
      .trim();
    if (!label) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(label);
  }

  return tags;
}

function asScrapeError(cause: unknown, url: string): DevpostScrapeError {
  if (cause instanceof Error && cause.name === "TimeoutError") {
    return new DevpostScrapeError(
      `DevPost fetch for ${url} timed out after ${FETCH_TIMEOUT_MS}ms`,
    );
  }
  return new DevpostScrapeError(
    `DevPost fetch failed for ${url}: ${String(cause)}`,
  );
}

/**
 * Fetches a DevPost project page and returns its "Built With" technologies.
 *
 * Throws `DevpostScrapeError` if the URL isn't a DevPost project link or the
 * page can't be fetched (a 404 means a deleted or still-private submission).
 */
export async function fetchDevpostTechStack(
  devpostUrl: string,
): Promise<string[]> {
  const url = normalizeDevpostUrl(devpostUrl);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (cause) {
    throw asScrapeError(cause, url);
  }

  if (!res.ok) {
    throw new DevpostScrapeError(
      `DevPost fetch for ${url} failed with status ${res.status}`,
    );
  }

  const landedOn = res.url ? new URL(res.url) : new URL(url);
  if (!/^\/software\/[^/]+/.test(landedOn.pathname)) {
    throw new DevpostScrapeError(
      landedOn.pathname.startsWith("/users/login")
        ? `DevPost sent ${url} to a login page — the project is private, unpublished, or deleted`
        : `DevPost redirected ${url} to ${landedOn.href}, which is not a project page`,
    );
  }

  let html: string;
  try {
    html = await res.text();
  } catch (cause) {
    throw asScrapeError(cause, url);
  }

  return parseBuiltWith(html);
}
