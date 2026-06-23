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

async function githubFetch(path: string): Promise<unknown> {
  const res = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
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
  const repo = match[2]!.replace(/\.git$/, "");
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
