import { TRPCClientError } from "@trpc/client";

// Shared look for the judge phone screen (colours ported from the judging mock).
export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b3fa0]";

export const primaryButton = `min-h-[56px] w-full rounded-xl bg-[#5b3fa0] px-4 text-lg font-bold text-white hover:bg-[#4d3488] disabled:cursor-not-allowed disabled:bg-[#9a8cc0] ${focusRing}`;

export const secondaryButton = `min-h-[48px] rounded-xl border-[1.5px] border-[#c3cad8] bg-white px-3 text-[15px] font-semibold text-[#0b2238] hover:bg-[#f6f7fa] disabled:cursor-not-allowed disabled:text-[#8a94a6] disabled:hover:bg-white ${focusRing}`;

export const card = "rounded-2xl border border-[#d6dbe5] bg-white";

/** tRPC error code (CONFLICT, FORBIDDEN, ...), or undefined for network/other failures. */
export function errorCode(error: unknown): string | undefined {
  if (!(error instanceof TRPCClientError)) return undefined;
  return (error.data as { code?: string } | undefined)?.code;
}

/** Plain-language message for a failed judge action; never the raw server text. */
export function friendlyError(
  error: unknown,
  conflict = "That didn't go through. Try again.",
): string {
  switch (errorCode(error)) {
    case "CONFLICT":
      return conflict;
    case "UNAUTHORIZED":
      return "You've been signed out. Sign in again to keep judging.";
    case "FORBIDDEN":
      return "You're not set up as a judge anymore. Ask an organizer.";
    case "NOT_FOUND":
      return "That mark couldn't be found. Refresh the page and try again.";
    case undefined:
      return "Couldn't reach the server. Check your connection and try again.";
    default:
      return "Something went wrong on our side. Try again.";
  }
}
