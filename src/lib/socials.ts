// Contact details hackers type or paste for the team finder. Forgiving on
// purpose: people paste whole profile links, "@handles", stray spaces and
// invisible characters, so we clean the value instead of rejecting it. A link
// to the wrong site is kept as typed with a hint, never guessed at.

export type ContactKind =
  | "discord"
  | "instagram"
  | "linkedin"
  | "github"
  | "phone";

export type Contacts = Partial<Record<ContactKind, string>>;

export type NormalizedContact = {
  /** What gets saved and shown. Empty when there's nothing usable. */
  value: string;
  /** Set when the value couldn't be read as this kind; `value` is then what they typed. */
  hint?: string;
  /** A softer check: `value` is cleaned and usable, but worth a second look. */
  note?: string;
};

const SITE: Record<Exclude<ContactKind, "phone">, string> = {
  discord: "Discord",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  github: "GitHub",
};

// Hosts we recognise, so a pasted link can be named in the hint.
const KNOWN_HOSTS: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)lnkd\.in$/, "LinkedIn"],
  [/(^|\.)github\.com$/, "GitHub"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)instagr\.am$/, "Instagram"],
  [/(^|\.)(discord\.com|discord\.gg|discordapp\.com)$/, "Discord"],
  [/(^|\.)(x\.com|twitter\.com)$/, "X"],
  [/(^|\.)devpost\.com$/, "Devpost"],
];

/** Zero-width spaces, joiners, BOMs, bidi marks, soft hyphens and the like. */
const INVISIBLE = /\p{Cf}/gu;

function visible(raw: string) {
  return raw.replace(INVISIBLE, "").trim();
}

function decode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * host + path segments when the text looks like a link, else null. Handles
 * with dots ("maya.codes") are not links: a link needs a scheme, "www.", a
 * path, or a host we recognise.
 */
function asLink(text: string): { host: string; segments: string[] } | null {
  const m =
    /^(https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(\/[^?#]*)?([?#].*)?$/i.exec(
      text,
    );
  if (!m) return null;
  const [, scheme, rawHost, path, rest] = m;
  const host = rawHost!.toLowerCase().replace(/^www\./, "");
  const looksLikeLink =
    Boolean(scheme) ||
    /^www\./i.test(rawHost!) ||
    Boolean(path) ||
    Boolean(rest) ||
    Boolean(siteOf(host));
  if (!looksLikeLink) return null;
  const segments = (path ?? "").split("/").filter(Boolean);
  return { host, segments };
}

function siteOf(host: string) {
  return KNOWN_HOSTS.find(([re]) => re.test(host))?.[1];
}

function handleOnly(text: string) {
  return text.replace(/^@+/, "");
}

/** Digits with an optional leading "+", formatted for North American numbers. */
export function formatPhone(raw: string) {
  const plus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 && !plus)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1"))
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return plus ? `+${digits}` : digits;
}

export function normalizeContact(
  kind: ContactKind,
  raw: string | undefined,
): NormalizedContact {
  const typed = visible(raw ?? "");
  if (!typed) return { value: "" };

  if (kind === "phone") return { value: formatPhone(typed) };

  // Handles never contain whitespace, so it can always go.
  const text = typed.replace(/\s+/g, "");
  const link = asLink(text);
  const site = SITE[kind];

  if (kind === "discord") {
    if (link)
      return { value: typed, hint: "Use your Discord username, not a link." };
    const value = handleOnly(text).toLowerCase();
    // "@ John Doe" → johndoe: spaces inside usually mean a display name.
    return /\S\s+\S/.test(typed)
      ? {
          value,
          note: "Check this is your Discord username, not your display name.",
        }
      : { value };
  }

  if (!link) return { value: decode(handleOnly(text)) };

  const linkSite = siteOf(link.host);
  if (linkSite !== site) {
    return {
      value: typed,
      hint: linkSite
        ? `That looks like ${/^[aeiou]/i.test(linkSite) ? "an" : "a"} ${linkSite} link. Add your ${site} instead.`
        : `That link isn't from ${site}.`,
    };
  }

  const [first, second] = link.segments;
  if (kind === "linkedin") {
    if (first !== "in" || !second)
      return {
        value: typed,
        hint: "Use your profile link (linkedin.com/in/…) or username.",
      };
    return { value: decode(second) };
  }
  if (kind === "instagram") {
    if (first === "stories" && second) return { value: decode(second) };
    if (!first || ["p", "reel", "reels", "tv", "explore"].includes(first))
      return {
        value: typed,
        hint: "That's not a profile link. Use your profile link or @username.",
      };
    return { value: decode(first) };
  }
  // GitHub: the first segment is the account, even on a repo link.
  if (!first)
    return { value: typed, hint: "Use your profile link or username." };
  return { value: decode(first) };
}

/** Profile link built from a cleaned value. Discord and phone have none. */
export function contactHref(kind: ContactKind, value: string) {
  const v = encodeURIComponent(value);
  if (kind === "instagram") return `https://instagram.com/${v}`;
  if (kind === "linkedin") return `https://www.linkedin.com/in/${v}`;
  if (kind === "github") return `https://github.com/${v}`;
  if (kind === "phone") return `tel:${value.replace(/[^\d+]/g, "")}`;
  return undefined;
}

/** Every contact cleaned; values with a hint are kept as typed. */
export function normalizeContacts(contacts: Contacts): Contacts {
  return Object.fromEntries(
    Object.entries(contacts).flatMap(([k, v]) => {
      const { value } = normalizeContact(k as ContactKind, v);
      return value ? [[k, value]] : [];
    }),
  );
}

/**
 * Whether someone can be messaged from these contacts: Discord, Instagram or
 * a phone number that reads cleanly (GitHub and LinkedIn take no DMs from
 * strangers).
 */
export function canBeMessaged(contacts: Contacts) {
  return (["discord", "instagram", "phone"] as const).some((k) => {
    const { value, hint } = normalizeContact(k, contacts[k]);
    return value !== "" && !hint;
  });
}
