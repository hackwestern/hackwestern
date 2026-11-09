/**
 * A login callbackUrl we're willing to send someone to: a path on this site
 * only. Anything else (absolute URLs, protocol-relative "//evil.com",
 * backslash tricks) returns null so the caller falls back to its default.
 */
export function safeCallbackPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return null;
  return raw;
}
