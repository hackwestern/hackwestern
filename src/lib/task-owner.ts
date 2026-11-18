/**
 * Who owns a run-of-show task, read from the sheet's Owner cell (T49).
 * Team tags ("[SPON]", "[WEB]", "+") are dropped. What's left is either one
 * person's name, or "no clear owner": empty, the whole team ("All"), several
 * people ("Noah & Caroline"), or a per-company list ("QNX: Noah ...").
 * A task with no clear owner pings the team channel instead of one person.
 */

export type TaskOwner =
  | { kind: "person"; name: string }
  | { kind: "none"; reason: "empty" | "everyone" | "several" | "per-company" };

/** Words that mean the whole team rather than one person. */
const EVERYONE = new Set([
  "all",
  "everyone",
  "everybody",
  "team",
  "the team",
  "all hands",
  "anyone",
]);

/** Separators between several people's names. */
const SEPARATOR = /\s*(?:,|&|\/|;|\n|\band\b)\s*/i;

export function parseTaskOwner(raw: string | null | undefined): TaskOwner {
  const text = (raw ?? "")
    .replace(/\[[^\]]*\]/g, " ") // [SPON], [WEB]
    .replace(/\+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/^[\s,;:&/-]+|[\s,;:&/-]+$/g, "");
  if (!text) return { kind: "none", reason: "empty" };
  // "Canada Life: Noah Manulife: Caroline": a different owner per company.
  if (text.includes(":")) return { kind: "none", reason: "per-company" };

  const names = text
    .split(SEPARATOR)
    .map((n) => n.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  const distinct = new Map<string, string>();
  for (const n of names) {
    if (!distinct.has(n.toLowerCase())) distinct.set(n.toLowerCase(), n);
  }
  if (distinct.size === 0) return { kind: "none", reason: "empty" };
  if ([...distinct.keys()].some((k) => EVERYONE.has(k))) {
    return { kind: "none", reason: "everyone" };
  }
  if (distinct.size > 1) return { kind: "none", reason: "several" };
  return { kind: "person", name: [...distinct.values()][0]! };
}
