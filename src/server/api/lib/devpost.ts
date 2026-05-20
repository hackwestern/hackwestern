/**
 * Minimal DevPost scraper.
 * DevPost has no public API, so we parse the project HTML directly.
 * This is intentionally fragile-tolerant: any parse failure returns an empty array
 * rather than throwing, so a broken page doesn't kill the whole cheat check.
 */

/**
 * Scrapes a DevPost project page and returns the list of team member usernames/display names.
 * DevPost renders members inside `<ul id="collaborators">` as anchor tags.
 */
export async function getDevpostTeamMembers(devpostUrl: string): Promise<string[]> {
  const res = await fetch(devpostUrl, {
    headers: {
      // Mimic a browser enough to avoid bot blocks
      "User-Agent":
        "Mozilla/5.0 (compatible; HackWesternCheatCheck/1.0; +https://hackwestern.com)",
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    throw new Error(`DevPost fetch failed with status ${res.status} for ${devpostUrl}`);
  }

  const html = await res.text();
  return parseCollaborators(html);
}

/**
 * Extracts collaborator names from DevPost HTML.
 * Targets the `<ul id="collaborators">` block and pulls display names from anchor tags.
 * Exported for unit testing.
 */
export function parseCollaborators(html: string): string[] {
  // Isolate the collaborators block first to avoid false matches
  const blockMatch = html.match(/<ul[^>]+id="collaborators"[^>]*>([\s\S]*?)<\/ul>/);
  if (!blockMatch?.[1]) return [];

  const block = blockMatch[1];

  // Each member is wrapped in an <a> tag — grab the visible text content
  const names: string[] = [];
  const anchorRegex = /<a[^>]*>[\s\S]*?<\/a>/g;
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(block)) !== null) {
    // Strip inner tags and collapse whitespace
    const text = match[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) names.push(text);
  }

  return names;
}

/**
 * Extracts the project title from a DevPost project page.
 * Used as the search query for the LinkedIn cross-post scan.
 */
export function parseProjectTitle(html: string): string | null {
  const match = html.match(/<h1[^>]*id="app-title"[^>]*>\s*([^<]+)\s*<\/h1>/);
  return match?.[1]?.trim() ?? null;
}
