/**
 * Match a run-of-show owner name ("Jess", "Brittney Chong", "Lucus") to one
 * organizer. Each name is one person. Order: the alias map
 * (src/content/ops-pings-aliases.ts), then the full name, then a first name
 * only one organizer has, then a close spelling (1 letter off, 2 for names
 * of 7+ letters) only one organizer has. Several candidates at any step: ambiguous, never a guess.
 * docs/decisions.md 2026-11-18 (ops pings).
 */

export type NameCandidate = {
  id: string;
  /** Display name, "Jessica Xing". */
  name: string;
  /** Other full names this person goes by (e.g. their Slack display name). */
  otherNames?: string[];
};

export type NameMatch =
  | {
      status: "one";
      id: string;
      name: string;
      via: "alias" | "full" | "first" | "close";
    }
  | { status: "many"; candidates: string[] }
  | { status: "none" };

/** Case, accents and spacing don't matter: "  Émily   LIU" -> "emily liu". */
export function foldName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}' -]/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const namesOf = (c: NameCandidate) =>
  [c.name, ...(c.otherNames ?? [])].map(foldName).filter(Boolean);
const firstWord = (n: string) => n.split(" ")[0] ?? "";

/** Levenshtein distance, stopping early above `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      cur.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

function pick(
  hits: NameCandidate[],
  via: "alias" | "full" | "first" | "close",
): NameMatch | null {
  const unique = [...new Map(hits.map((c) => [c.id, c])).values()];
  if (unique.length === 1) {
    return { status: "one", id: unique[0]!.id, name: unique[0]!.name, via };
  }
  if (unique.length > 1) {
    return { status: "many", candidates: unique.map((c) => c.name).sort() };
  }
  return null;
}

/** Fold the alias map's keys once: { "jess": "Jessica Xing" }. */
export function foldAliases(
  aliases: Record<string, string>,
): Map<string, string> {
  return new Map(
    Object.entries(aliases).map(([k, v]) => [foldName(k), foldName(v)]),
  );
}

export function matchName(
  name: string,
  candidates: NameCandidate[],
  aliases = new Map<string, string>(),
): NameMatch {
  const key = foldName(name);
  if (!key) return { status: "none" };

  const alias = aliases.get(key);
  if (alias) {
    // The alias names one person; if they aren't here, no fallback guess.
    return (
      pick(
        candidates.filter((c) => namesOf(c).includes(alias)),
        "alias",
      ) ?? { status: "none" }
    );
  }

  const full = pick(
    candidates.filter((c) => namesOf(c).includes(key)),
    "full",
  );
  if (full) return full;

  const single = !key.includes(" ");
  if (single) {
    const first = pick(
      candidates.filter((c) => namesOf(c).some((n) => firstWord(n) === key)),
      "first",
    );
    if (first) return first;
  }

  // A close spelling ("Lucus", "Brittany" for Brittney): one letter off for
  // names of 4-6 letters, two for 7+. Shorter names never match this way.
  if (key.length >= 4) {
    const max = key.length >= 7 ? 2 : 1;
    const close = pick(
      candidates.filter((c) =>
        namesOf(c).some(
          (n) => editDistance(single ? firstWord(n) : n, key, max) <= max,
        ),
      ),
      "close",
    );
    if (close) return close;
  }
  return { status: "none" };
}
