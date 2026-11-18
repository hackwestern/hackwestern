import {
  SlackApiError,
  slackApi,
  type SlackResponse,
} from "~/server/slack/client";

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

export type SlackMember = {
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
/** A rate-limited page is retried once if Slack asks for at most this. */
export const MAX_RETRY_AFTER_S = 5;
const PAGE_LIMIT = 200;
const MAX_PAGES = 50;

const norm = (name: string | undefined) =>
  (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** False for Slackbot, bots, apps, deactivated users and guests. */
export function isActivePerson(m: SlackMember): m is SlackMember & { id: string } {
  if (!m.id || m.id === "USLACKBOT") return false;
  const skip = [
    m.deleted,
    m.is_bot,
    m.is_app_user,
    m.is_restricted,
    m.is_ultra_restricted,
  ];
  return !skip.some((flag) => flag === true);
}

/** A member's matchable names; null for bots, deactivated users and guests. */
export function directoryEntry(m: SlackMember): SlackDirectoryUser | null {
  if (!isActivePerson(m)) return null;
  const real = norm(m.profile?.real_name ?? m.real_name);
  const firstName = norm(m.profile?.first_name);
  const first = firstName.length > 0 ? firstName : (real.split(" ")[0] ?? "");
  const names = new Set(
    [first, real, norm(m.real_name), norm(m.profile?.display_name)].filter(
      Boolean,
    ),
  );
  return names.size > 0 ? { id: m.id, names: [...names] } : null;
}

type UsersListPage = SlackResponse & {
  members?: SlackMember[];
  response_metadata?: { next_cursor?: string };
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Every member on every page of users.list, unfiltered. A rate-limited page
 * (429) is retried once when Slack's Retry-After is short. Throws a
 * SlackApiError when Slack refuses.
 */
export async function fetchSlackMembers(
  token: string,
  fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = wait,
): Promise<SlackMember[]> {
  const members: SlackMember[] = [];
  let cursor: string | undefined;
  let retried = false;
  const page = (c: string | undefined) =>
    slackApi<UsersListPage>(
      token,
      "users.list",
      { limit: String(PAGE_LIMIT), cursor: c },
      fetchImpl,
      5000,
    );
  for (let n = 0; n < MAX_PAGES; n++) {
    let res: UsersListPage;
    try {
      res = await page(cursor);
    } catch (error) {
      const after =
        error instanceof SlackApiError && error.code === "http_429"
          ? error.retryAfter
          : null;
      if (retried || after === null || after > MAX_RETRY_AFTER_S) throw error;
      retried = true;
      await sleep(after * 1000);
      res = await page(cursor);
    }
    members.push(...(res.members ?? []));
    const next = res.response_metadata?.next_cursor;
    cursor = next?.length ? next : undefined;
    if (!cursor) break;
  }
  return members;
}

/** The workspace's people, as matchable names (see directoryEntry). */
export async function fetchSlackDirectory(
  token: string,
  fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = wait,
): Promise<SlackDirectoryUser[]> {
  const members = await fetchSlackMembers(token, fetchImpl, sleep);
  return members.flatMap((m) => {
    const entry = directoryEntry(m);
    return entry ? [entry] : [];
  });
}

let cache: { token: string; at: number; users: SlackDirectoryUser[] } | null =
  null;

/** Tests only. */
export function resetSlackDirectoryCache(): void {
  cache = null;
}

/**
 * The directory, from the 10-minute cache when fresh. When Slack fails, an
 * expired copy is better than nothing (people rarely leave mid-event); with
 * no copy at all the error is thrown.
 */
export async function getSlackDirectory(
  token: string,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
  sleep?: (ms: number) => Promise<void>,
): Promise<SlackDirectoryUser[]> {
  const cached = cache?.token === token ? cache : null;
  if (cached && now - cached.at < DIRECTORY_TTL_MS) return cached.users;
  try {
    const users = await fetchSlackDirectory(token, fetchImpl, sleep);
    cache = { token, at: now, users };
    return users;
  } catch (error) {
    if (!cached) throw error;
    console.error("slack directory: refresh failed, using the old copy", error);
    return cached.users;
  }
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
