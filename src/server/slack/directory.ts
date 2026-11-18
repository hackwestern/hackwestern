import { slackApi, type SlackResponse } from "~/server/slack/client";

/**
 * The Slack workspace's people (users.list, needs users:read), so a task
 * owner's name from the sheet can be matched to a Slack user without anyone
 * typing emails. Cached for 10 minutes per token.
 */

export type SlackDirectoryUser = {
  id: string;
  /** Lowercased names this user answers to (first, real, display). */
  names: string[];
};

type SlackMember = {
  id?: string;
  deleted?: boolean;
  is_bot?: boolean;
  is_app_user?: boolean;
  is_restricted?: boolean;
  is_ultra_restricted?: boolean;
  real_name?: string;
  profile?: {
    first_name?: string;
    real_name?: string;
    display_name?: string;
  };
};

export const DIRECTORY_TTL_MS = 10 * 60_000;
const PAGE_LIMIT = 200;
const MAX_PAGES = 50;

const norm = (name: string | undefined) =>
  (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** A member's matchable names; null for bots, deactivated users and guests. */
export function directoryEntry(m: SlackMember): SlackDirectoryUser | null {
  if (!m.id || m.id === "USLACKBOT") return null;
  if (m.deleted || m.is_bot || m.is_app_user) return null;
  if (m.is_restricted || m.is_ultra_restricted) return null;
  const real = norm(m.profile?.real_name ?? m.real_name);
  const first = norm(m.profile?.first_name) || real.split(" ")[0] || "";
  const names = new Set(
    [first, real, norm(m.real_name), norm(m.profile?.display_name)].filter(
      Boolean,
    ),
  );
  return names.size > 0 ? { id: m.id, names: [...names] } : null;
}

/** Every page of users.list. Throws a SlackApiError when Slack refuses. */
export async function fetchSlackDirectory(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SlackDirectoryUser[]> {
  const users: SlackDirectoryUser[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await slackApi<
      SlackResponse & {
        members?: SlackMember[];
        response_metadata?: { next_cursor?: string };
      }
    >(
      token,
      "users.list",
      { limit: String(PAGE_LIMIT), cursor },
      fetchImpl,
      5000,
    );
    for (const m of res.members ?? []) {
      const entry = directoryEntry(m);
      if (entry) users.push(entry);
    }
    cursor = res.response_metadata?.next_cursor || undefined;
    if (!cursor) break;
  }
  return users;
}

let cache: { token: string; at: number; users: SlackDirectoryUser[] } | null =
  null;

/** Tests only. */
export function resetSlackDirectoryCache(): void {
  cache = null;
}

/** The directory, from the 10-minute cache when fresh. */
export async function getSlackDirectory(
  token: string,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<SlackDirectoryUser[]> {
  if (cache?.token === token && now - cache.at < DIRECTORY_TTL_MS) {
    return cache.users;
  }
  const users = await fetchSlackDirectory(token, fetchImpl);
  cache = { token, at: now, users };
  return users;
}

export type DirectoryMatch =
  | { status: "one"; userId: string }
  | { status: "none" }
  | { status: "many" };

/** Match one person's name (any case) against first/real/display names. */
export function matchSlackUser(
  name: string,
  directory: SlackDirectoryUser[],
): DirectoryMatch {
  const key = norm(name);
  if (!key) return { status: "none" };
  const ids = new Set(
    directory.filter((u) => u.names.includes(key)).map((u) => u.id),
  );
  if (ids.size === 1) return { status: "one", userId: [...ids][0]! };
  return ids.size === 0 ? { status: "none" } : { status: "many" };
}
