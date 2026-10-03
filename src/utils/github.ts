import { env } from "~/env";

const GITHUB_API_BASE = "https://api.github.com";

function getHeaders(): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` }
      : {}),
  };
}

/**
 * Thrown when GitHub turns us away for rate-limiting rather than for something
 * wrong with the request. Callers that run many repos in a row (the cheat-check
 * sweep) treat this differently from a real failure: it doesn't consume the
 * team's retry budget, and it pauses the whole run until `resetAt`.
 */
export class GithubRateLimitError extends Error {
  readonly resetAt: Date;

  constructor(message: string, resetAt: Date) {
    super(message);
    this.name = "GithubRateLimitError";
    this.resetAt = resetAt;
  }
}

/**
 * Reads the reset time out of a rate-limited response. GitHub signals it either
 * as `retry-after` (delta seconds, used for secondary limits) or
 * `x-ratelimit-reset` (unix seconds, used for the primary limit). Falls back to
 * a minute out when neither is present or parseable.
 */
function parseRateLimitReset(res: Response): Date {
  const retryAfter = Number(res.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return new Date(Date.now() + retryAfter * 1000);
  }

  const reset = Number(res.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) {
    return new Date(reset * 1000);
  }

  return new Date(Date.now() + 60_000);
}

/**
 * A 403/429 is rate-limiting only when GitHub says so — a 403 on a private repo
 * is an ordinary permission failure and must not pause the sweep.
 */
function isRateLimited(res: Response): boolean {
  if (res.status !== 403 && res.status !== 429) return false;
  return (
    res.headers.get("x-ratelimit-remaining") === "0" ||
    res.headers.has("retry-after")
  );
}

async function githubFetch(path: string): Promise<unknown> {
  const res = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    if (isRateLimited(res)) {
      throw new GithubRateLimitError(
        `GitHub rate limit hit (${res.status}) for ${path}`,
        parseRateLimitReset(res),
      );
    }
    throw new Error(
      `GitHub API error ${res.status} for ${path}: ${await res.text()}`,
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GithubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string; // ISO 8601
    };
    message: string;
  };
  author: { login: string } | null; // null for unlinked accounts
}

export interface GithubContributor {
  login: string;
  id: number;
  contributions: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts { owner, repo } from a GitHub URL.
 * Handles https://github.com/owner/repo, .git suffix, and /tree/branch suffixes.
 */
export function parseGithubUrl(
  url: string,
): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
  if (!match?.[1] || !match?.[2]) return null;
  const repo = match[2].replace(/\.git$/, "");
  return { owner: match[1], repo };
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Fetches all commits for a repo (paginates automatically).
 */
export async function fetchAllCommits(
  owner: string,
  repo: string,
): Promise<GithubCommit[]> {
  const commits: GithubCommit[] = [];
  let page = 1;
  while (true) {
    const data = (await githubFetch(
      `/repos/${owner}/${repo}/commits?per_page=100&page=${page}`,
    )) as GithubCommit[];
    commits.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return commits;
}

/**
 * Fetches all contributors for a repo.
 * Note: GitHub links at most 500 email addresses to accounts; the rest are anonymous (login absent).
 */
export async function fetchContributors(
  owner: string,
  repo: string,
): Promise<GithubContributor[]> {
  return (await githubFetch(
    `/repos/${owner}/${repo}/contributors?per_page=100`,
  )) as GithubContributor[];
}
