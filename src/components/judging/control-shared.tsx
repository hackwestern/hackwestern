import { useEffect, useState } from "react";
import { trackEnum } from "~/server/db/schema";
import { type RouterOutputs } from "~/utils/api";

export type QueueState = RouterOutputs["judging"]["admin"]["getQueue"];
export type QueueTeam = QueueState["teams"][number];
export type JudgeRow =
  RouterOutputs["judging"]["admin"]["getAllJudges"][number];
export type RankingRow =
  RouterOutputs["judging"]["admin"]["getLatestRanking"][number];

// "General" is every team's base track; the rest are sponsor prizes
// (same split as the judging seed).
export const SPONSOR_TRACKS = trackEnum.enumValues.filter(
  (t) => t !== "General",
);

export const LONG_HOLD_MS = 5 * 60 * 1000;

export const CARD =
  "flex min-w-0 flex-col gap-3 rounded-2xl border border-[#d6dbe5] bg-white p-4 sm:p-5";
export const CARD_TITLE = "m-0 text-lg font-bold";
export const MUTED = "text-[#4a5d73]";
export const BTN_DARK =
  "min-h-11 rounded-[10px] bg-[#0b2238] px-4 text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_OUTLINE =
  "min-h-11 rounded-[10px] border-[1.5px] border-[#c3cad8] bg-white px-3.5 text-[15px] font-semibold text-[#0b2238] disabled:cursor-not-allowed disabled:opacity-50";
export const FIELD =
  "min-h-11 rounded-[10px] border-[1.5px] border-[#c3cad8] bg-white px-2.5 text-[15px]";
export const TH = "px-2 py-2 font-semibold first:pl-0 last:pr-0";
export const TD = "px-2 py-2.5 first:pl-0 last:pr-0";

/** Re-render every `ms` so hold timers and "Updated Xs ago" tick. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Milliseconds as m:ss (minutes keep counting past 59). */
export function formatHold(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Plain-language text for a failed tRPC call. */
export function errorText(error: {
  message: string;
  data?: { zodError?: unknown } | null;
}): string {
  if (error.data?.zodError) return "Check what you entered and try again.";
  return error.message;
}

export type Status = { tone: "ok" | "error"; text: string } | null;

/** Result line under an action. Always mounted so screen readers hear it. */
export function StatusLine({ status }: { status: Status }) {
  const tone =
    status?.tone === "error"
      ? "bg-[#fdecea] text-[#7a1a0f]"
      : "bg-[#e4effd] text-[#123d75]";
  return (
    <p
      aria-live="polite"
      className={`m-0 rounded-xl px-4 py-3 text-[15px] font-medium empty:hidden ${tone}`}
    >
      {status?.text}
    </p>
  );
}

/** A judge's display name: their account name, else their email. */
export function judgeName(j: { name: string | null; email: string }): string {
  return j.name ?? j.email;
}
