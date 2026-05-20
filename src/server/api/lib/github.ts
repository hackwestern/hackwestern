import { env } from "~/env";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Hacking begins at 9pm EST on Friday November 21 2025 (= 02:00 UTC November 22).
 * Any commit authored before this timestamp is a pre-event violation.
 */
export const HACK_START_UTC = new Date("2025-11-22T02:00:00Z");

/**
 * First commit within the event window with more than this many additions is flagged
 * as suspiciously large (pre-written code dropped in at start).
 */
export const LARGE_COMMIT_THRESHOLD = 500;

function getHeaders(): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
  };
}

async function githubFetch(path: string): Promise<unknown> {
  const res = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status} for ${path}: ${await res.text()}`);
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

export interface GithubCommitDetail extends GithubCommit {
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
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
export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s.#?]+)/);
  if (!match?.[1] || !match?.[2]) return null;
  return { owner: match[1], repo: match[2] };
}

/**
 * Extracts a GitHub username from a profile URL like https://github.com/username.
 */
export function parseGithubUsername(url: string): string | null {
  const match = url.match(/github\.com\/([^/\s?#]+)\/?$/);
  return match?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Fetches all commits for a repo (paginates automatically).
 */
export async function fetchAllCommits(owner: string, repo: string): Promise<GithubCommit[]> {
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
 * Fetches detailed stats (additions/deletions) for a single commit SHA.
 */
export async function fetchCommitStats(
  owner: string,
  repo: string,
  sha: string,
): Promise<GithubCommitDetail["stats"]> {
  const data = (await githubFetch(`/repos/${owner}/${repo}/commits/${sha}`)) as GithubCommitDetail;
  return data.stats ?? { additions: 0, deletions: 0, total: 0 };
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
