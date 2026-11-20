/**
 * Ping Logs types shared by the server (ping-log-sources.ts) and the page.
 * No server imports here: the page bundle includes this file.
 */

export const PING_KINDS = [
  "organizer",
  "coffee",
  "presentation",
  "help",
  "task",
  "marketing",
] as const;
export type PingKind = (typeof PING_KINDS)[number];

/** How a status reads at a glance. */
export type PingTone = "ok" | "waiting" | "problem" | "done";

export type PingEntry = {
  kind: PingKind;
  at: Date;
  to: string;
  about: string;
  /** Raw status key; the page turns it into words. */
  status: string;
  tone: PingTone;
  detail?: string;
};
