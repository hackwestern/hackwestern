// Card rules shared by the team finder page and the server, so both sides
// enforce the same limits.
import { z } from "zod";
import {
  type ContactKind,
  type Contacts,
  canBeMessaged,
  normalizeContact,
} from "./socials";

export const SKILLS = [
  "Frontend",
  "Backend",
  "Design",
  "Hardware",
  "ML / AI",
  "Mobile",
  "Pitching",
] as const;
export type Skill = (typeof SKILLS)[number];
export const MAX_SKILLS = 3;
export const TEXT_LIMIT = 100;

const CONTACT_KINDS = [
  "discord",
  "instagram",
  "linkedin",
  "github",
  "phone",
] as const;

const text = z.string().trim().max(TEXT_LIMIT);

export const cardInput = z.object({
  needs: z.union([z.literal(1), z.literal(2)]).nullable(),
  skills: z
    .array(z.enum(SKILLS))
    .max(MAX_SKILLS)
    .refine((s) => new Set(s).size === s.length, "Duplicate skill"),
  firstHackathon: z.boolean(),
  lookingFor: text,
  idea: text.nullable(),
  showSchool: z.boolean(),
  showYear: z.boolean(),
  contacts: z.record(z.enum(CONTACT_KINDS), z.string().max(300).optional()),
  shown: z.boolean(),
});
export type CardInput = z.infer<typeof cardInput>;

export type CleanCard = Omit<CardInput, "contacts" | "idea"> & {
  idea: string | null;
  contacts: Partial<Record<ContactKind, string | null>>;
};

/** Contacts cleaned; any that only produced a hint are dropped to null. */
export function cleanCard(input: CardInput): CleanCard {
  const contacts: CleanCard["contacts"] = {};
  for (const [kind, raw] of Object.entries(input.contacts)) {
    const { value, hint } = normalizeContact(kind as ContactKind, raw);
    contacts[kind as ContactKind] = value && !hint ? value : null;
  }
  return { ...input, idea: input.idea === "" ? null : input.idea, contacts };
}

/** A card can go on the board with something to say and a way to be messaged. */
export function canShow(card: Pick<CleanCard, "lookingFor" | "contacts">) {
  const contacts: Contacts = {};
  for (const [kind, value] of Object.entries(card.contacts)) {
    if (value) contacts[kind as ContactKind] = value;
  }
  return card.lookingFor !== "" && canBeMessaged(contacts);
}

/** "John D."; first name only when there's no last name. */
export function displayName(first: string | null, last: string | null) {
  const f = first?.trim() ?? "";
  const l = last?.trim() ?? "";
  return l ? `${f} ${l[0]!.toUpperCase()}.`.trim() : f;
}

export function yearLabel(year: string | null) {
  return year && /^\d/.test(year) ? `${year} year` : undefined;
}

export function schoolLabel(school: string | null, schoolOther: string | null) {
  const s = school === "Other" ? schoolOther : school;
  const t = s?.trim();
  return t ? t : undefined;
}
