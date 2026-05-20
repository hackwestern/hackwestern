import { env } from "~/env";

const SERP_API_BASE = "https://serpapi.com/search.json";

export interface SerpResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * Searches Google (via SerpAPI) for a project name appearing on LinkedIn.
 * Used to detect cross-posting — i.e. a team submitting a project they already
 * posted publicly before the hackathon.
 *
 * Returns null if SERP_API_KEY is not configured.
 */
export async function searchLinkedIn(projectName: string): Promise<SerpResult[] | null> {
  if (!env.SERP_API_KEY) return null;

  const query = `"${projectName}" site:linkedin.com`;
  const url = new URL(SERP_API_BASE);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", env.SERP_API_KEY);
  url.searchParams.set("num", "10");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`SerpAPI error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    organic_results?: { title: string; link: string; snippet: string }[];
  };

  return (data.organic_results ?? []).map((r) => ({
    title: r.title,
    link: r.link,
    snippet: r.snippet,
  }));
}

/**
 * Searches GitHub (via SerpAPI) for a project name appearing on GitHub before the event.
 * Looks for the repo or references to it outside the submitted repo.
 */
export async function searchGithub(projectName: string): Promise<SerpResult[] | null> {
  if (!env.SERP_API_KEY) return null;

  const query = `"${projectName}" site:github.com`;
  const url = new URL(SERP_API_BASE);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", env.SERP_API_KEY);
  url.searchParams.set("num", "10");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`SerpAPI error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    organic_results?: { title: string; link: string; snippet: string }[];
  };

  return (data.organic_results ?? []).map((r) => ({
    title: r.title,
    link: r.link,
    snippet: r.snippet,
  }));
}
