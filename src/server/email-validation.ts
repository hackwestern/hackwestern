import { resolveMx } from "dns/promises";

// Free signup-email validation: format check + disposable-domain blocklist +
// domain-existence (MX) lookup. Runs before we send a confirmation, so junk
// addresses never generate a bounce. It does NOT catch a well-formed address
// whose mailbox simply doesn't exist (e.g. a nonexistent gmail) — only a paid
// verification API can do that. The MX lookup fails OPEN: any DNS hiccup, or a
// domain that exists without MX records (A-record mail fallback), is allowed
// through so a legitimate signup is never blocked.

// Common disposable / throwaway providers used to spam signups. Not exhaustive.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamailblock.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "sharklasers.com",
  "mailnesia.com",
  "mintemail.com",
  "spam4.me",
  "mohmal.com",
  "emailondeck.com",
  "mailcatch.com",
]);

// Pragmatic email shape: single @, non-empty local part, dotted domain, 2+ char TLD.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type EmailValidation = { ok: true } | { ok: false; reason: string };

export function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

export async function validateSignupEmail(
  email: string,
): Promise<EmailValidation> {
  const trimmed = email.trim();
  if (!EMAIL_RE.test(trimmed)) {
    return { ok: false, reason: "That email address doesn't look valid." };
  }

  const domain = domainOf(trimmed);
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      ok: false,
      reason: "Please use a permanent (non-disposable) email address.",
    };
  }

  try {
    await resolveMx(domain);
  } catch (err) {
    // ENOTFOUND = the domain does not resolve at all -> definitely junk.
    // ENODATA (no MX, but domain exists) / timeouts / anything else -> fail open.
    if ((err as { code?: string })?.code === "ENOTFOUND") {
      return { ok: false, reason: "That email domain doesn't exist." };
    }
  }

  return { ok: true };
}
