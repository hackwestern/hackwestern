// Team finder: confirmed hackers make a card and browse everyone else's once
// RSVP closes. Organizers can browse and hide cards at any time.
import Image from "next/image";
import Head from "next/head";
import Link from "next/link";
import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { signOut } from "next-auth/react";
import { TRPCClientError } from "@trpc/client";
import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  Github,
  Instagram,
  Link2,
  Linkedin,
  Phone,
  Search,
  Sparkles,
} from "lucide-react";
import SEO from "~/components/seo";
import {
  MAX_SKILLS,
  SKILLS,
  TEXT_LIMIT,
  linkLabel,
  type CardInput,
  type Skill,
} from "~/lib/team-finder";
import { formatRsvpDeadline } from "~/lib/date";
import { resizeToWebp } from "~/lib/resize-image";
import { authOptions } from "~/server/auth";
import { getTeamFinderAccess } from "~/server/api/utils/team-finder-access";
import { api, type RouterOutputs } from "~/utils/api";
import { Button } from "~/components/ui/button";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { FilmStrip } from "~/components/promo/film-strip";
import { getHorse } from "~/constants/realms";
import {
  canBeMessaged,
  contactHref,
  normalizeContact,
  normalizeContacts,
  type ContactKind,
  type Contacts,
} from "~/lib/socials";

type Socials = Contacts;

type CardView = RouterOutputs["teamFinder"]["list"][number];
type Me = RouterOutputs["teamFinder"]["getMine"]["prefill"];

type Hacker = {
  /** Set on cards from the server; the form's preview has none. */
  id?: string;
  name: string;
  school?: string;
  year?: string;
  horseId: number | null;
  /** Optional photo; without one the card shows their horse. */
  photo?: string;
  /** How many more people they're looking for. Unset = looking for a team to join. */
  needs?: Needs;
  firstHackathon?: boolean;
  skills: string[];
  lookingFor: string;
  idea?: string;
  socials: Socials;
  /** An organizer hid this card. Only organizers and its owner get these. */
  hiddenByOrganizer?: boolean;
};

const TEAM_SIZE = 4;
type Needs = 1 | 2;

function fromView(v: CardView): Hacker {
  return {
    id: v.id,
    name: v.name,
    school: v.school,
    year: v.year,
    horseId: v.horseId,
    photo: v.photoUrl,
    needs: v.needs ?? undefined,
    firstHackathon: v.firstHackathon,
    skills: v.skills,
    lookingFor: v.lookingFor,
    idea: v.idea ?? undefined,
    socials: v.contacts,
    hiddenByOrganizer: v.hiddenByOrganizer,
  };
}

// 24 fills whole rows at both 3 and 2 columns.
const PAGE_SIZE = 24;
const FIRST = "First hackathon";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a16bc7] focus-visible:ring-offset-2";
const FIELD = `w-full rounded-lg border border-gray-2 bg-white px-3 py-2.5 font-figtree text-base text-heavy placeholder:text-gray-3 focus:border-[#a16bc7] focus:outline-none focus:ring-2 focus:ring-[#e1c8fa]`;
const PHOTO_NOTE =
  "rounded-xl bg-black/60 px-3 py-2 text-sm text-white backdrop-blur-sm";

type Filter = "everyone" | "solo" | "groups";

/**
 * The card picture: their photo if they added one, otherwise their horse on
 * its realm tint. Size comes from `className` (h-/w- classes).
 */
function Avatar({
  horseId,
  photo,
  className = "",
  round = false,
}: {
  horseId: number | null;
  photo?: string;
  className?: string;
  /** A small circle (the status bar), instead of the card's rounded tile. */
  round?: boolean;
}) {
  const shape = round ? "rounded-full border-2 border-white" : "rounded-2xl";
  // Photo links expire after an hour, so a long-open tab falls back to the horse.
  const [failed, setFailed] = useState<string>();
  if (photo && photo !== failed)
    return (
      <div className={`shrink-0 overflow-hidden ${shape} ${className}`}>
        <Image
          src={photo}
          alt=""
          width={256}
          height={256}
          unoptimized
          onError={() => setFailed(photo)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  const horse = getHorse(horseId);
  return (
    <div
      className={`shrink-0 overflow-hidden ${shape} ${round ? "p-1" : "p-1.5"} ${className}`}
      // One neutral tile for every horse: the realm tints competed with the cards.
      style={{ background: "#f2eff5" }}
    >
      <Image
        src={horse?.asset ?? "/apply/realm/safari-1.png"}
        alt=""
        width={96}
        height={96}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

// Only contacts that read cleanly; links are built from the cleaned handle.
function cleanContacts(raw: Socials): Socials {
  const clean = (k: ContactKind) => {
    const { value, hint } = normalizeContact(k, raw[k]);
    return hint ? "" : value;
  };
  return {
    discord: clean("discord"),
    phone: clean("phone"),
    instagram: clean("instagram"),
    linkedin: clean("linkedin"),
    github: clean("github"),
  };
}

// Green = solo, looking for a team to join; orange = a group looking for more.
// "Solo" and "Group" match the All / Solo / Groups filter.
function needsLabel(needs?: Needs) {
  return needs
    ? `Group, looking for ${needs} more`
    : "Solo, looking for a team";
}

function Status({ needs }: { needs?: Needs }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-medium">
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full border-[1.5px] border-[#7a4aa3] ${needs ? "bg-[#7a4aa3]" : ""}`}
      />
      {needsLabel(needs)}
    </span>
  );
}

// Discord's mark (simple-icons, CC0): lucide has none.
function DiscordIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

const ICON_BTN = `inline-flex h-10 w-10 items-center sm:h-8 sm:w-8 justify-center rounded-md text-medium hover:bg-[#f3eefa] hover:text-heavy ${FOCUS}`;
// Small dark chips: no labels, no big buttons, kept inside the viewport.
const CHIP = `w-auto max-w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border-0 bg-[#1f1029] px-3 py-2 font-figtree text-[13px] text-white shadow-lg`;
const CHIP_BTN = `rounded-sm font-semibold text-white/90 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80`;

async function writeClipboard(value: string) {
  if (!navigator.clipboard) throw new Error("No clipboard");
  await navigator.clipboard.writeText(value);
}

function selectText(id: string) {
  const el = document.getElementById(id);
  const sel = window.getSelection();
  if (!el || !sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

// Discord: hover or focus shows the username; a click copies it. "Copied"
// only after the clipboard write succeeds; if it fails, a chip opens with the
// username selected to copy by hand.
function DiscordContact({ value }: { value: string }) {
  const textId = useId();
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const [toast, setToast] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const onCopy = async () => {
    window.clearTimeout(timer.current);
    try {
      await writeClipboard(value);
      setCopy("copied");
      // Touch screens have no hover tooltip, so they get a toast instead.
      setToast(window.matchMedia("(hover: none)").matches);
      timer.current = window.setTimeout(() => {
        setCopy("idle");
        setToast(false);
      }, 2000);
    } catch {
      setCopy("failed");
    }
  };
  return (
    <PopoverPrimitive.Root
      open={copy === "failed"}
      onOpenChange={(o) => !o && setCopy("idle")}
    >
      <PopoverPrimitive.Anchor asChild>
        <span className="group relative inline-flex">
          <button
            type="button"
            aria-label={`Discord: ${value}, copy username`}
            onClick={() => void onCopy()}
            className={ICON_BTN}
          >
            <DiscordIcon className="h-4 w-4" />
          </button>
          <span
            aria-hidden
            className={`pointer-events-none absolute bottom-full left-0 mb-2 whitespace-nowrap rounded-md bg-[#1f1029] px-2 py-1 text-[13px] font-medium text-white opacity-0 shadow-md group-hover:opacity-100 [@media(hover:none)]:hidden`}
          >
            {copy === "copied" ? "Copied" : value}
            <span
              className={`absolute left-3 top-full border-4 border-transparent border-t-[#1f1029]`}
            />
          </span>
        </span>
      </PopoverPrimitive.Anchor>
      <span role="status" aria-live="polite" className="sr-only">
        {copy === "copied" ? `Copied ${value}` : ""}
      </span>
      {toast && (
        <span
          aria-hidden
          className={`fixed bottom-8 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 truncate rounded-full bg-[#1f1029] px-4 py-2 font-figtree text-[13px] font-medium text-white shadow-lg`}
        >
          Copied {value}
        </span>
      )}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            selectText(textId);
          }}
          className={`z-50 ${CHIP}`}
        >
          <p id={textId} className="select-all break-all font-semibold">
            {value}
          </p>
          <p className="mt-0.5 text-white/70">
            Couldn’t copy. It’s selected for you.
          </p>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// Phone: a compact dark chip with the number and Call · Text · Copy.
function PhoneContact({ value }: { value: string }) {
  const textId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const tel = contactHref("phone", value) ?? "";
  const onCopy = async () => {
    try {
      await writeClipboard(value);
      setCopy("copied");
    } catch {
      selectText(textId);
      setCopy("failed");
    }
  };
  return (
    <Popover onOpenChange={(o) => !o && setCopy("idle")}>
      <PopoverTrigger
        aria-label={`Phone: ${value}`}
        title={value}
        className={ICON_BTN}
      >
        <Phone aria-hidden className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        tabIndex={-1}
        align="start"
        side="top"
        sideOffset={6}
        collisionPadding={12}
        // Focus the chip itself, not its first button, so no ring appears.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          contentRef.current?.focus();
        }}
        className={`${CHIP} p-0 px-3 py-2 outline-none`}
      >
        <p id={textId} className="select-all whitespace-nowrap font-semibold">
          {value}
        </p>
        <p className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-white/50">
          <a href={tel} className={CHIP_BTN}>
            Call
          </a>
          ·
          <a href={tel.replace(/^tel:/, "sms:")} className={CHIP_BTN}>
            Text
          </a>
          ·
          <button
            type="button"
            onClick={() => void onCopy()}
            className={CHIP_BTN}
          >
            {copy === "copied"
              ? "Copied"
              : copy === "failed"
                ? "Select it"
                : "Copy"}
          </button>
        </p>
        <span role="status" aria-live="polite" className="sr-only">
          {copy === "copied"
            ? `Copied ${value}`
            : copy === "failed"
              ? "Couldn’t copy, the number is selected"
              : ""}
        </span>
      </PopoverContent>
    </Popover>
  );
}

// Every contact as one row of same-size icons.
function ContactIcons({
  socials: raw,
  owner,
}: {
  socials: Socials;
  owner: string;
}) {
  const c = cleanContacts(raw);
  const links = (
    [
      ["instagram", Instagram, "Instagram"],
      ["linkedin", Linkedin, "LinkedIn"],
      ["github", Github, "GitHub"],
    ] as const
  ).flatMap(([k, Icon, label]) =>
    c[k] ? [{ k, Icon, label, value: c[k], href: contactHref(k, c[k])! }] : [],
  );
  if (!c.discord && !c.phone && !links.length) return null;
  return (
    <div className="relative z-10 flex flex-wrap items-center gap-1">
      {c.discord && <DiscordContact value={c.discord} />}
      {c.phone && <PhoneContact value={c.phone} />}
      {links.map(({ k, Icon, label, value, href }) => (
        <a
          key={k}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`${owner} on ${label}`}
          title={`${label}: ${value}`}
          className={ICON_BTN}
        >
          <Icon aria-hidden className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}

function EntryCard({
  entry,
  muted = false,
  clamp = false,
  you = false,
  ownBar,
  action,
}: {
  entry: Hacker;
  muted?: boolean;
  you?: boolean;
  /** Your own card in the grid: its label and actions (outside the open button). */
  ownBar?: ReactNode;
  /** Grid cards: short text, one contact row, and the whole card opens the full view. */
  clamp?: boolean;
  /** Beside the contacts in the full view (Report). */
  action?: ReactNode;
}) {
  const subtitle = [entry.school, entry.year].filter(Boolean).join(", ");
  const dialogRef = useRef<HTMLDivElement>(null);
  return (
    <article
      className={`relative flex flex-col gap-2.5 rounded-xl bg-white p-4 text-heavy shadow-[0_1px_2px_rgba(26,10,36,0.08),0_6px_16px_rgba(26,10,36,0.08)] ${clamp ? "h-full hover:shadow-[0_1px_2px_rgba(26,10,36,0.1),0_10px_24px_rgba(26,10,36,0.14)]" : ""} ${muted ? "outline-dashed outline-2 outline-offset-4 outline-[#a16bc7]" : ""}`}
    >
      {clamp && (
        <Dialog>
          {/* The whole card is the button; contacts sit above it. */}
          <DialogTrigger
            aria-label={`Open ${entry.name}’s card`}
            className={`absolute inset-0 z-0 rounded-xl ${FOCUS}`}
          />
          <DialogContent
            ref={dialogRef}
            tabIndex={-1}
            aria-describedby={undefined}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              dialogRef.current?.focus();
            }}
            className="max-h-[85dvh] max-w-md overflow-y-auto overscroll-contain border-0 bg-transparent p-0 shadow-none outline-none"
          >
            <DialogTitle className="sr-only">{entry.name}</DialogTitle>
            <EntryCard entry={entry} you={you} action={action} />
          </DialogContent>
        </Dialog>
      )}
      {ownBar && (
        <div className="pointer-events-auto relative z-10 -mt-1 flex h-8 flex-nowrap items-center gap-2">
          {ownBar}
        </div>
      )}
      <div className="pointer-events-none flex flex-col gap-2.5">
        <div className="flex items-start gap-3.5">
          <Avatar
            horseId={entry.horseId}
            photo={entry.photo}
            className={
              clamp
                ? "h-[88px] w-[88px] xl:h-[72px] xl:w-[72px]"
                : "h-[88px] w-[88px]"
            }
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Status needs={entry.needs} />
              {you && !ownBar && (
                <span className="text-[13px] font-semibold text-[#7a4aa3]">
                  You
                </span>
              )}
            </div>
            <h3 className="mt-1 font-cossetteTexte text-xl font-bold leading-tight [overflow-wrap:anywhere]">
              {entry.name}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-sm text-medium">{subtitle}</p>
            )}
          </div>
        </div>

        {(entry.skills.length > 0 || entry.firstHackathon) && (
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label={entry.needs ? "What the group can do" : "Skills"}
          >
            {entry.firstHackathon && (
              <li className="inline-flex items-center gap-1 rounded-md bg-[#f2eff5] px-2 py-0.5 text-[13px] font-medium text-heavy">
                <Sparkles aria-hidden className="h-3 w-3 text-[#7a4aa3]" />
                First hackathon
              </li>
            )}
            {entry.skills.map((s) => (
              <li
                key={s}
                className="rounded-md bg-[#f2eff5] px-2 py-0.5 text-[13px] font-medium text-heavy"
              >
                {s}
              </li>
            ))}
          </ul>
        )}

        {entry.lookingFor && (
          <p
            className={`text-[15px] leading-snug [overflow-wrap:anywhere] ${clamp ? "line-clamp-3" : ""}`}
          >
            <span className="font-semibold">
              {entry.needs ? "Needs " : "Wants "}
            </span>
            {lowerFirst(entry.lookingFor)}
          </p>
        )}
        {entry.idea && (
          <p
            className={`text-sm leading-snug text-medium [overflow-wrap:anywhere] ${clamp ? "line-clamp-1" : "pointer-events-auto"}`}
          >
            <Idea idea={entry.idea} />
          </p>
        )}
      </div>

      <div
        className={`pointer-events-auto relative z-10 ${clamp ? "mt-auto" : ""}`}
      >
        {clamp ? (
          <div className="border-t border-gray-1 pt-2">
            <ContactIcons socials={entry.socials} owner={entry.name} />
          </div>
        ) : (
          <div className="flex items-center gap-2 border-t border-gray-1 pt-2">
            <ContactIcons socials={entry.socials} owner={entry.name} />
            {action && <div className="ml-auto">{action}</div>}
          </div>
        )}
      </div>
    </article>
  );
}

/** A project idea that's a link opens it; anything else stays text. */
function Idea({ idea }: { idea: string }) {
  // A link anywhere in the idea: needs a scheme or a path, so "maya.codes" stays text.
  const m = /(https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(\/[^\s]*)?/i.exec(idea);
  if (!m || (!m[1] && !m[3])) return <>{idea}</>;
  const href = m[1] ? m[0] : `https://${m[0]}`;
  const path = (m[3] ?? "").split(/[?#]/)[0]!.split("/").filter(Boolean);
  const host = m[2]!.toLowerCase().replace(/^www\./, "");
  const label = linkLabel(host, path);
  const text = idea.replace(m[0], "").trim();
  return (
    <>
      {text && <>{text} </>}
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={`${host}/${path.join("/")}`}
        aria-label={`Project link: ${label}`}
        className={`pointer-events-auto relative z-10 inline-flex max-w-full items-center gap-1 rounded-sm align-bottom font-medium text-heavy underline-offset-4 hover:underline ${FOCUS}`}
      >
        <Link2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#7a4aa3]" />
        <span className="truncate">{label}</span>
      </a>
    </>
  );
}

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// Phones: one tappable row per person; details open in place.
function CompactRow({
  entry,
  you = false,
  ownBar,
  muted = false,
  action,
}: {
  entry: Hacker;
  you?: boolean;
  /** Your own row: label and actions, always visible. */
  ownBar?: ReactNode;
  /** Hidden from others. */
  muted?: boolean;
  /** Beside the contacts once open (Report). */
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const room = entry.firstHackathon ? 1 : 2;
  const extra = entry.skills.length - room;
  return (
    <li
      className={
        muted
          ? "outline-dashed outline-2 -outline-offset-4 outline-[#a16bc7]"
          : ""
      }
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full scroll-mb-24 scroll-mt-36 items-center gap-3 px-4 py-3 text-left hover:bg-[#faf7fc] ${FOCUS} focus-visible:ring-inset focus-visible:ring-offset-0`}
      >
        <Avatar
          horseId={entry.horseId}
          photo={entry.photo}
          className="h-14 w-14"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-cossetteTexte text-[17px] font-bold leading-tight">
            {entry.name}
            {you && (
              <span className="font-figtree text-sm font-semibold text-medium">
                {" "}
                (you)
              </span>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-medium">
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full border-[1.5px] border-[#7a4aa3] ${entry.needs ? "bg-[#7a4aa3]" : ""}`}
            />
            <span className="truncate">
              {needsLabel(entry.needs)}
              {entry.school ? `, ${entry.school}` : ""}
            </span>
          </span>
          {entry.lookingFor && (
            <span className="mt-1 block truncate text-sm text-heavy">
              <span className="font-semibold">
                {entry.needs ? "Needs " : "Wants "}
              </span>
              {lowerFirst(entry.lookingFor)}
            </span>
          )}
          <span className="mt-1.5 flex flex-wrap gap-1">
            {entry.firstHackathon && (
              <span className="inline-flex items-center gap-1 rounded bg-[#f2eff5] px-1.5 py-px text-xs font-medium text-heavy">
                <Sparkles aria-hidden className="h-3 w-3 text-[#7a4aa3]" />
                First hackathon
              </span>
            )}
            {entry.skills.slice(0, room).map((s) => (
              <span
                key={s}
                className="rounded bg-[#f2eff5] px-1.5 py-px text-xs font-medium text-heavy"
              >
                {s}
              </span>
            ))}
            {extra > 0 && (
              <span className="px-1 text-xs font-semibold text-medium">
                +{extra}
              </span>
            )}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={`h-5 w-5 shrink-0 text-medium transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      {ownBar && (
        <div className="px-4 pb-3 pl-[84px]">
          <div className="flex h-8 flex-nowrap items-center gap-2">
            {ownBar}
          </div>
        </div>
      )}
      <div
        id={detailsId}
        hidden={!open}
        className={`${open ? "flex" : "hidden"} flex-col gap-2.5 px-4 pb-4 pl-[84px]`}
      >
        {entry.year && <p className="text-sm text-medium">{entry.year}</p>}
        {(entry.skills.length > 0 || entry.firstHackathon) && (
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label={entry.needs ? "What the group can do" : "Skills"}
          >
            {entry.firstHackathon && (
              <li className="inline-flex items-center gap-1 rounded-md bg-[#f2eff5] px-2 py-0.5 text-[13px] font-medium text-heavy">
                <Sparkles aria-hidden className="h-3 w-3 text-[#7a4aa3]" />
                First hackathon
              </li>
            )}
            {entry.skills.map((s) => (
              <li
                key={s}
                className="rounded-md bg-[#f2eff5] px-2 py-0.5 text-[13px] font-medium text-heavy"
              >
                {s}
              </li>
            ))}
          </ul>
        )}
        {entry.lookingFor && (
          <p className="text-[15px] leading-snug [overflow-wrap:anywhere]">
            <span className="font-semibold">
              {entry.needs ? "Needs " : "Wants "}
            </span>
            {lowerFirst(entry.lookingFor)}
          </p>
        )}
        {entry.idea && (
          <p className="text-sm leading-snug text-medium [overflow-wrap:anywhere]">
            <Idea idea={entry.idea} />
          </p>
        )}
        <div className="flex items-center gap-2">
          <ContactIcons socials={entry.socials} owner={entry.name} />
          {action && <div className="ml-auto">{action}</div>}
        </div>
      </div>
    </li>
  );
}

type Card = {
  /** The saved photo's URL, or a picked one waiting for Save. */
  photo?: string;
  show: { school: boolean; year: boolean };
  needs?: Needs;
  skills: Skill[];
  firstHackathon: boolean;
  lookingFor: string;
  idea: string;
  socials: Socials;
  /** Shown to other hackers. */
  listed: boolean;
};

// A new card: only what comes from the application is filled in.
const BLANK_CARD: Card = {
  show: { school: true, year: false },
  skills: [],
  firstHackathon: false,
  lookingFor: "",
  idea: "",
  socials: {},
  listed: false,
};

/** A saved card, back in the form's shape. */
function toCard(v: CardView): Card {
  return {
    photo: v.photoUrl,
    show: { school: v.school !== undefined, year: v.year !== undefined },
    needs: v.needs ?? undefined,
    skills: v.skills,
    firstHackathon: v.firstHackathon,
    lookingFor: v.lookingFor,
    idea: v.idea ?? "",
    socials: v.contacts,
    listed: v.shown,
  };
}

function toInput(c: Card): CardInput {
  return {
    needs: c.needs ?? null,
    skills: c.skills,
    firstHackathon: c.firstHackathon,
    lookingFor: c.lookingFor,
    idea: c.idea,
    showSchool: c.show.school,
    showYear: c.show.year,
    contacts: c.socials,
    shown: c.listed,
  };
}

function toHacker(c: Card, me: Me): Hacker {
  return {
    name: me.name,
    school: c.show.school ? me.school : undefined,
    year: c.show.year ? me.year : undefined,
    horseId: me.horseId,
    photo: c.photo,
    needs: c.needs,
    firstHackathon: c.firstHackathon,
    skills: c.skills,
    lookingFor: c.lookingFor,
    idea: c.idea.trim() || undefined,
    socials: c.socials,
  };
}

async function toBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// Showing a card needs someone to look for and a way to be messaged: Discord,
// Instagram or a phone number (GitHub and LinkedIn have no DMs from strangers).
function isReady(c: Card) {
  return c.lookingFor.trim() !== "" && canBeMessaged(c.socials);
}

// Step one: make (or edit) your card, with a live preview. Whether to show it
// to other hackers is the last choice before saving.
function CardStage({
  initial,
  isNew,
  me,
  blocked,
  photosOff,
  onSave,
  onLeave,
}: {
  initial: Card;
  isNew: boolean;
  me: Me;
  /** An organizer hid this card, so it can't be shown. */
  blocked: boolean;
  /** Photo storage isn't set up: the card keeps the horse. */
  photosOff: boolean;
  /** `photo`: a new one to upload, or null to remove the saved one. */
  onSave: (c: Card, photo?: Blob | null) => Promise<void>;
  onLeave: () => void;
}) {
  const ids = useId();
  const formId = `${ids}-form`;
  const [c, setC] = useState<Card>(initial);
  const set = <K extends keyof Card>(key: K, value: Card[K]) =>
    setC((x) => ({ ...x, [key]: value }));
  const ready = isReady(c);
  // What gets saved: the owner's choice, kept while an organizer hides the card.
  const listed = c.listed && ready;
  // What other hackers will see.
  const visible = listed && !blocked;
  const preview = toHacker(c, me);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // A picked photo is resized right away (WebP or JPEG, no EXIF/GPS) and
  // uploaded on Save.
  const [newPhoto, setNewPhoto] = useState<Blob | null>();
  const [photoError, setPhotoError] = useState("");
  const setPhoto = async (file?: File) => {
    if (file && !file.type.startsWith("image/"))
      return setPhotoError("That file isn’t an image. Pick a JPG or PNG.");
    if (file && file.size > 10 * 1024 * 1024)
      return setPhotoError("That image is over 10 MB. Pick a smaller one.");
    setPhotoError("");
    let blob: Blob | undefined;
    if (file) {
      try {
        blob = await resizeToWebp(file);
      } catch {
        return setPhotoError("Couldn’t use that image. Try another one.");
      }
    }
    if (c.photo?.startsWith("blob:")) URL.revokeObjectURL(c.photo);
    set("photo", blob ? URL.createObjectURL(blob) : undefined);
    setNewPhoto(blob ?? (initial.photo ? null : undefined));
  };
  // Hints show once a field has been left, not while someone is mid-paste.
  const [hints, setHints] = useState<Partial<Record<ContactKind, string>>>({});
  const cleanField = (key: ContactKind) => {
    const raw = c.socials[key];
    if (raw === undefined) return;
    const { value, hint, note } = normalizeContact(key, raw);
    // Phone stays ticked even when emptied; other fields drop when blank.
    set("socials", {
      ...c.socials,
      [key]: value || (key === "phone" ? "" : undefined),
    });
    setHints((h) => ({ ...h, [key]: hint ?? note }));
  };

  const socialFields = [
    ["discord", "Discord username", "your.username…"],
    ["instagram", "Instagram", "username…"],
    ["linkedin", "LinkedIn", "linkedin.com/in/…"],
    ["github", "GitHub", "username…"],
  ] as const;

  const previewCard = (
    <>
      <p className={PHOTO_NOTE}>
        {visible
          ? "This is how other hackers will see your card."
          : "Preview. Only you can see your card until you choose to show it."}
      </p>
      <EntryCard entry={preview} muted={!visible} />
    </>
  );

  return (
    <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-12">
      <div className="flex flex-col gap-6">
        <form
          id={formId}
          aria-labelledby="stage-h"
          onKeyDown={(e) => {
            const t = e.target as HTMLElement;
            if (e.key === "Enter" && t instanceof HTMLInputElement)
              e.preventDefault();
          }}
          className="flex flex-col gap-6 rounded-2xl bg-white p-5 text-heavy shadow-lg sm:p-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (saving) return;
            setSaving(true);
            setSaveFailed(false);
            onSave(
              { ...c, socials: normalizeContacts(c.socials), listed },
              newPhoto,
            )
              .catch(() => setSaveFailed(true))
              .finally(() => setSaving(false));
          }}
        >
          <fieldset>
            <legend className="mb-2 font-semibold">
              From your application
            </legend>
            <div className="flex flex-col gap-2 text-[15px]">
              {(
                [
                  ["school", me.school],
                  ["year", me.year],
                ] as const
              )
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-3"
                  >
                    <span
                      className={c.show[key] ? "" : "text-medium line-through"}
                    >
                      {value}
                    </span>
                    <span className="flex items-center gap-2 text-sm text-medium">
                      {c.show[key] ? "Shown" : "Hidden"}
                      <input
                        type="checkbox"
                        name={`show-${key}`}
                        checked={c.show[key]}
                        onChange={() =>
                          set("show", { ...c.show, [key]: !c.show[key] })
                        }
                        className="h-4 w-4 accent-[#a16bc7]"
                      />
                    </span>
                  </label>
                ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-semibold">
              Photo <span className="font-normal text-medium">(optional)</span>
            </legend>
            <div className="flex items-center gap-4">
              <Avatar
                horseId={me.horseId}
                photo={c.photo}
                className="h-[72px] w-[72px]"
              />
              {photosOff ? (
                <p className="text-sm text-medium">
                  Photos aren’t available yet.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-full border border-gray-2 px-3.5 py-1.5 text-sm font-semibold text-heavy focus-within:ring-2 focus-within:ring-[#a16bc7] focus-within:ring-offset-2 hover:border-[#a16bc7]">
                    {c.photo ? "Change" : "Upload a photo"}
                    <input
                      type="file"
                      name="photo"
                      accept="image/*"
                      aria-describedby={
                        photoError ? `${ids}-photo-err` : undefined
                      }
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void setPhoto(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {c.photo && (
                    <button
                      type="button"
                      onClick={() => void setPhoto(undefined)}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold text-medium hover:text-heavy ${FOCUS}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
            {!photosOff && (
              <p className="mt-2 text-sm text-medium">
                Without one, your card shows your horse.
              </p>
            )}
            {photoError && (
              <p
                id={`${ids}-photo-err`}
                role="alert"
                className="mt-1 text-sm text-[#9a4c14]"
              >
                {photoError}
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-semibold">
              What are you looking for?
            </legend>
            <div className="flex flex-wrap gap-2">
              {([undefined, 1, 2] as const).map((n) => {
                const on = c.needs === n;
                return (
                  <button
                    key={n ?? "solo"}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("needs", n)}
                    className={`rounded-md border px-2.5 py-1 text-sm font-semibold transition-colors motion-reduce:transition-none ${FOCUS} ${
                      on
                        ? "border-[#cdb2ea] bg-[#ebdff7] text-heavy"
                        : "border-gray-2 bg-white text-medium hover:border-[#cdb2ea] hover:text-heavy"
                    }`}
                  >
                    {n === undefined
                      ? "A team to join"
                      : n === 1
                        ? "1 more person"
                        : "2 more people"}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-medium">
              Solo? Pick “A team to join”, even if you only want one partner.
            </p>
            {c.needs && (
              <p className="mt-1 text-sm text-medium">
                Only one of you needs a card. Describe the whole group.
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-semibold">
              {c.needs ? "What your group can do" : "What you’re good at"}
            </legend>
            <p className="-mt-1 mb-2 text-sm text-medium">
              Pick up to {MAX_SKILLS} so your strongest ones stand out.
            </p>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => {
                const on = c.skills.includes(s);
                const full = !on && c.skills.length >= MAX_SKILLS;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    disabled={full}
                    onClick={() =>
                      set(
                        "skills",
                        on ? c.skills.filter((x) => x !== s) : [...c.skills, s],
                      )
                    }
                    className={`rounded-md border px-2.5 py-1 text-sm font-semibold transition-colors motion-reduce:transition-none ${FOCUS} ${
                      on
                        ? "border-[#cdb2ea] bg-[#ebdff7] text-heavy"
                        : "border-gray-2 bg-white text-medium hover:border-[#cdb2ea] hover:text-heavy disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-2 disabled:hover:text-medium"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="flex items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              name="first-hackathon"
              checked={c.firstHackathon}
              onChange={() => set("firstHackathon", !c.firstHackathon)}
              className="h-4 w-4 accent-[#a16bc7]"
            />
            {c.needs ? "It’s our first hackathon" : "It’s my first hackathon"}
          </label>

          <div>
            <label
              htmlFor={`${ids}-looking`}
              className="mb-2 block font-semibold"
            >
              Who would fit your team?
            </label>
            <input
              id={`${ids}-looking`}
              className={FIELD}
              name="looking-for"
              autoComplete="off"
              value={c.lookingFor}
              maxLength={TEXT_LIMIT}
              placeholder="A designer who likes shipping fast…"
              onChange={(e) => set("lookingFor", e.target.value)}
            />
          </div>

          <div>
            <label htmlFor={`${ids}-idea`} className="mb-2 block font-semibold">
              Project idea{" "}
              <span className="font-normal text-medium">(optional)</span>
            </label>
            <input
              id={`${ids}-idea`}
              className={FIELD}
              name="idea"
              autoComplete="off"
              placeholder="A live bus tracker for campus…"
              value={c.idea}
              maxLength={TEXT_LIMIT}
              onChange={(e) => set("idea", e.target.value)}
            />
          </div>

          <fieldset>
            <legend className="mb-1 font-semibold">How to reach you</legend>
            <p className="mb-3 text-sm text-medium">
              Add Discord, Instagram or your phone number so people can message
              you. GitHub and LinkedIn are extras. Only hackers going to Hack
              Western see these.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {socialFields.map(([key, label, placeholder]) => (
                <div key={key}>
                  <label
                    htmlFor={`${ids}-${key}`}
                    className="mb-1 block text-sm text-medium"
                  >
                    {label}
                  </label>
                  <input
                    id={`${ids}-${key}`}
                    className={FIELD}
                    placeholder={placeholder}
                    name={key}
                    value={c.socials[key] ?? ""}
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby={
                      hints[key] ? `${ids}-${key}-hint` : undefined
                    }
                    onChange={(e) =>
                      set("socials", {
                        ...c.socials,
                        [key]: e.target.value || undefined,
                      })
                    }
                    onBlur={() => cleanField(key)}
                  />
                  {hints[key] && (
                    <p
                      id={`${ids}-${key}-hint`}
                      className="mt-1 text-sm text-[#9a4c14]"
                    >
                      {hints[key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <label className="flex items-center gap-3 text-[15px]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#a16bc7]"
                  name="show-phone"
                  checked={c.socials.phone !== undefined}
                  onChange={(e) =>
                    set("socials", {
                      ...c.socials,
                      phone: e.target.checked ? (me.phone ?? "") : undefined,
                    })
                  }
                />
                Show my phone number
              </label>
              {c.socials.phone !== undefined && (
                <div>
                  <label
                    htmlFor={`${ids}-phone`}
                    className="mb-1 block text-sm text-medium"
                  >
                    Phone number (from your application, edit if you like)
                  </label>
                  <input
                    id={`${ids}-phone`}
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={FIELD}
                    value={c.socials.phone}
                    onChange={(e) =>
                      set("socials", { ...c.socials, phone: e.target.value })
                    }
                    onBlur={() => cleanField("phone")}
                  />
                </div>
              )}
            </div>
          </fieldset>
        </form>

        {/* Phones: the preview sits right before the last step. */}
        <div className="flex flex-col gap-3 lg:hidden">{previewCard}</div>

        <section
          aria-labelledby={`${ids}-show-h`}
          className="flex flex-col gap-4 rounded-2xl bg-white p-5 text-heavy shadow-lg sm:p-7"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={`${ids}-show-h`} className="font-semibold">
                Show me to other hackers
              </h2>
              <p id={`${ids}-show-d`} className="mt-1 text-sm text-medium">
                Hackers going to Hack Western will see your card and can message
                you. You can turn this off any time.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={visible}
              aria-labelledby={`${ids}-show-h`}
              aria-describedby={
                ready && !blocked
                  ? `${ids}-show-d`
                  : `${ids}-show-d ${ids}-notready`
              }
              disabled={!ready || blocked}
              onClick={() => set("listed", !c.listed)}
              className={`mt-0.5 shrink-0 rounded-full disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}
            >
              <span
                className={`relative block h-6 w-11 rounded-full transition-colors motion-reduce:transition-none ${visible ? "bg-[#a16bc7]" : "bg-gray-2"}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${visible ? "translate-x-5" : "translate-x-0"}`}
                />
              </span>
            </button>
          </div>
          {(!ready || blocked) && (
            <p
              id={`${ids}-notready`}
              className="rounded-lg bg-[#fff0e6] px-3 py-2 text-sm text-[#9a4c14]"
            >
              {blocked
                ? "An organizer hid your card."
                : "Add who would fit your team and a way to message you (Discord, Instagram or phone) first."}
            </p>
          )}
          <Button
            type="submit"
            form={formId}
            variant="primary"
            full
            isPending={saving}
            className="h-12 min-h-0 py-0 font-figtree font-medium"
          >
            {visible ? "Save and show my card" : "Save, hidden"}
          </Button>
          {saveFailed && (
            <p
              role="alert"
              className="-mt-2 text-center text-sm text-[#9a4c14]"
            >
              Couldn’t save. Try again.
            </p>
          )}
          <button
            type="button"
            onClick={onLeave}
            className={`self-center rounded-sm text-sm font-semibold text-medium underline underline-offset-4 hover:text-heavy ${FOCUS}`}
          >
            {isNew ? "Skip for now" : "Back without saving"}
          </button>
        </section>
      </div>

      <aside
        aria-label="Preview of your card"
        className="hidden flex-col gap-3 lg:sticky lg:top-24 lg:flex"
      >
        {previewCard}
      </aside>
    </div>
  );
}

// Report someone else's card to the organizers, with an optional note.
function ReportCard({ cardId }: { cardId: string }) {
  const noteId = useId();
  const [note, setNote] = useState("");
  const report = api.teamFinder.report.useMutation();
  return (
    <Popover
      onOpenChange={(o) => {
        if (o) return;
        setNote("");
        if (!report.isPending) report.reset();
      }}
    >
      <PopoverTrigger
        className={`rounded-sm px-2 py-2 text-[13px] font-semibold text-medium underline-offset-4 hover:text-heavy hover:underline sm:p-0 ${FOCUS}`}
      >
        Report
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={6}
        collisionPadding={12}
        className="font-figtree text-heavy shadow-lg"
      >
        {report.isSuccess ? (
          <p className="text-sm">Thanks. An organizer will take a look.</p>
        ) : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!report.isPending)
                report.mutate({ cardId, note: note.trim() });
            }}
          >
            <label htmlFor={noteId} className="text-sm font-semibold">
              What’s wrong?{" "}
              <span className="font-normal text-medium">(optional)</span>
            </label>
            <textarea
              id={noteId}
              name="note"
              autoComplete="off"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${FIELD} resize-none text-sm`}
            />
            <button
              type="submit"
              disabled={report.isPending}
              className={`self-end rounded-full bg-[#7a4aa3] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#673d8c] disabled:opacity-60 ${FOCUS}`}
            >
              Send report
            </button>
            {report.isError && (
              <p role="alert" className="text-sm text-[#9a4c14]">
                {report.error?.message === "report-limit"
                  ? "You’ve sent too many reports today."
                  : "Couldn’t send. Try again."}
              </p>
            )}
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}

type FilterProps = {
  variant: "inline" | "rail";
  query: string;
  filter: Filter;
  canDo: string[];
  onQuery: (v: string) => void;
  onFilter: (f: Filter) => void;
  onToggle: (c: string) => void;
};

// Search and filters. Phones and tablets get them above the list (pinned on
// phones); desktops get them in a quiet left rail.
function Filters({
  variant,
  query,
  filter,
  canDo,
  onQuery,
  onFilter,
  onToggle,
}: FilterProps) {
  const searchId = useId();
  const rail = variant === "rail";

  const search = (
    <>
      <label htmlFor={searchId} className="sr-only">
        Search names, skills, schools and ideas
      </label>
      <div
        className={`flex min-w-[150px] items-center gap-2 rounded-full bg-white px-3 focus-within:ring-2 focus-within:ring-[#a16bc7] md:px-4 ${rail ? "" : "flex-1"}`}
      >
        <Search aria-hidden className="h-4 w-4 shrink-0 text-medium" />
        <input
          id={searchId}
          name="search"
          autoComplete="off"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search…"
          className="h-11 w-full bg-transparent text-base text-heavy outline-none placeholder:text-gray-3"
        />
      </div>
    </>
  );

  const show = (
    <div
      role="group"
      aria-label="Show"
      className="flex shrink-0 rounded-full bg-white p-1"
    >
      {(
        [
          ["everyone", "All"],
          ["solo", "Solo"],
          ["groups", "Groups"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={filter === key}
          onClick={() => onFilter(key)}
          className={`h-9 rounded-full px-3 text-sm font-semibold transition-colors motion-reduce:transition-none md:px-3.5 ${rail ? "flex-1" : ""} ${FOCUS} ${
            filter === key
              ? "bg-[#7a4aa3] text-white"
              : "text-medium hover:text-heavy"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  // Frosted chips so they read over the photo; the one accent fills a chip that's on.
  const chips = (
    <div
      role="group"
      aria-label="Can do"
      className={`flex flex-wrap items-center gap-1.5 ${rail ? "" : "lg:hidden"}`}
    >
      <span
        className={`mr-1 shrink-0 text-sm font-semibold text-white ${rail ? "w-full" : ""}`}
      >
        Can do
      </span>
      {[...SKILLS, FIRST].map((c) => {
        const on = canDo.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(c)}
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors motion-reduce:transition-none sm:py-1 ${FOCUS} focus-visible:ring-offset-transparent ${
              on
                ? "border-[#7a4aa3] bg-[#7a4aa3] text-white"
                : "border-white/40 bg-white/15 text-white backdrop-blur-md hover:border-white/70 hover:bg-white/25"
            }`}
          >
            {c === FIRST && <Sparkles aria-hidden className="h-3 w-3" />}
            {c}
          </button>
        );
      })}
    </div>
  );

  const tip = (
    <p className={`text-sm text-white/75 ${rail ? "pt-1" : "lg:hidden"}`}>
      Tip: add people on Discord as a friend. Instagram DMs land in requests.
    </p>
  );

  if (rail)
    return (
      <div className="hidden flex-col gap-5 lg:sticky lg:top-24 lg:flex">
        <div
          role="search"
          aria-label="Find hackers"
          className="flex flex-col gap-3"
        >
          {search}
          {show}
          {chips}
          {tip}
        </div>
      </div>
    );
  return (
    <>
      {/* Pinned on phones so search and filters stay in reach. */}
      <div className="sticky top-6 z-10 -mx-2 flex flex-wrap items-center gap-2 rounded-[28px] bg-black/30 p-1.5 backdrop-blur-md md:static md:mx-0 md:gap-3 md:bg-transparent md:p-0 md:backdrop-blur-none lg:hidden">
        {search}
        {show}
      </div>
      {chips}
      {tip}
    </>
  );
}

type Access = "hacker" | "organizer" | "not-open" | "not-confirmed" | "closed";

type TeamFinderProps = {
  access: Access;
  /** When RSVP closes, formatted on the server. */
  deadlineText: string;
  /** Their own email, only when they're turned away: catches a wrong account. */
  email: string | null;
};

const BACKDROP = "#1f1029";
const SKIPPED_KEY = "hw13-team-finder-skipped";

function skippedBefore() {
  try {
    return localStorage.getItem(SKIPPED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberSkip() {
  try {
    localStorage.setItem(SKIPPED_KEY, "1");
  } catch {
    // Storage blocked: they get the card step again next visit.
  }
}

const photosUnavailable = (e: unknown) =>
  e instanceof TRPCClientError && e.message === "photos-unavailable";

/**
 * A blurred stand-in for the board behind the "not yet"/"not for you" screens,
 * so they show what's here without loading anyone's card.
 */
function BoardTeaser() {
  return (
    // The fade sits on a padded wrapper so the blur's soft edge isn't clipped.
    <div
      aria-hidden
      className="pointer-events-none -mx-4 mt-8 select-none p-4 [mask-image:linear-gradient(to_bottom,black_35%,transparent)]"
    >
      {/* Frosted glass cards in the backdrop's colours, not white ones faded
          to grey. */}
      <div className="grid grid-cols-1 gap-4 blur-[2px] sm:grid-cols-2 lg:grid-cols-3">
        {[3, 7, 1, 12, 5, 9].map((horseId, i) => (
          <div
            key={horseId}
            className={`flex flex-col gap-3 rounded-xl bg-white/[0.07] p-4 ring-1 ring-inset ring-white/15 ${i >= 3 ? "hidden sm:flex" : ""}`}
          >
            <div className="flex items-center gap-3.5">
              <div className="h-16 w-16 shrink-0 rounded-2xl bg-white/10 p-1.5">
                <Image
                  src={getHorse(horseId)?.asset ?? "/apply/realm/safari-1.png"}
                  alt=""
                  width={96}
                  height={96}
                  className="h-full w-full object-contain opacity-60"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-4 w-2/3 rounded-full bg-white/25" />
                <div className="h-3 w-1/2 rounded-full bg-white/15" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-20 rounded-md bg-white/10" />
              <div className="h-6 w-16 rounded-md bg-white/10" />
            </div>
            <div className="h-3 w-full rounded-full bg-white/10" />
            <div className="h-3 w-4/5 rounded-full bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TeamFinder({
  access,
  deadlineText,
  email,
}: TeamFinderProps) {
  const open = access === "hacker" || access === "organizer";
  const organizer = access === "organizer";

  const utils = api.useUtils();
  // No refetch on focus: every fetch signs the photo URLs again, so all the
  // photos would download again.
  const mineQuery = api.teamFinder.getMine.useQuery(undefined, {
    enabled: access === "hacker",
    refetchOnWindowFocus: false,
  });
  const listQuery = api.teamFinder.list.useQuery(undefined, {
    enabled: open,
    refetchOnWindowFocus: false,
  });
  const myCard = mineQuery.data?.card ?? null;
  const blocked = mineQuery.data?.hiddenByOrganizer ?? false;
  const card = useMemo(() => (myCard ? toCard(myCard) : null), [myCard]);
  // On the board for others: shown by its owner and not hidden by an organizer.
  const visible = !!card?.listed && !blocked;
  const loaded = !!listQuery.data && (organizer || !!mineQuery.data);
  const failed = mineQuery.isError || listQuery.isError;

  // First visit with no card opens the card step; a saved card, or having
  // skipped it before on this device, opens the board. Organizers never get a card.
  const [stage, setStage] = useState<"card" | "board" | null>(
    organizer ? "board" : null,
  );
  if (stage === null && mineQuery.data) {
    setStage(
      mineQuery.data.card !== null || skippedBefore() ? "board" : "card",
    );
  }
  const board = stage === "board" && !failed;

  // Moving between the two steps: back to the top, focus on the new heading.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    for (const el of [document.scrollingElement, document.body])
      el?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [stage]);
  const goTo = (next: "card" | "board") => {
    moved.current = true;
    setStage(next);
  };
  const skip = () => {
    rememberSkip();
    goTo("board");
  };

  const setMine = (saved: CardView) =>
    utils.teamFinder.getMine.setData(
      undefined,
      (d) => d && { ...d, card: saved },
    );
  const saveMine = api.teamFinder.saveMine.useMutation();
  const uploadPhoto = api.teamFinder.uploadPhoto.useMutation();
  const removePhoto = api.teamFinder.removePhoto.useMutation();
  const setShown = api.teamFinder.setShown.useMutation({ onSuccess: setMine });
  const [photosOff, setPhotosOff] = useState(false);
  // Shown on the board when the card saved but its photo step didn't.
  const [photoNote, setPhotoNote] = useState("");
  const save = async (c: Card, photo?: Blob | null) => {
    let saved = await saveMine.mutateAsync(toInput(c));
    setPhotoNote("");
    try {
      if (photo === null) saved = await removePhoto.mutateAsync();
      if (photo)
        saved = await uploadPhoto.mutateAsync({
          photoBase64: await toBase64(photo),
        });
    } catch (e) {
      // The card is saved even when its photo isn't, so carry on to the board.
      if (photosUnavailable(e)) setPhotosOff(true);
      setPhotoNote(
        photo === null
          ? "Your photo couldn’t be removed."
          : "Your photo couldn’t be uploaded.",
      );
    }
    setMine(saved);
    goTo("board");
  };

  // Organizers get the cards they hid too, flagged. A hide or unhide flips
  // the flag in place: a refetch would download every photo again.
  const setHidden = (cardId: string, hidden: boolean) =>
    utils.teamFinder.list.setData(undefined, (d) =>
      d?.map((v) =>
        v.id === cardId ? { ...v, hiddenByOrganizer: hidden } : v,
      ),
    );
  const hideCard = api.teamFinder.hideCard.useMutation({
    onSuccess: (_, { cardId }) => setHidden(cardId, true),
  });
  const unhideCard = api.teamFinder.unhideCard.useMutation({
    onSuccess: (_, { cardId }) => setHidden(cardId, false),
  });

  const [filter, setFilter] = useState<Filter>("everyone");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [canDo, setCanDo] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query);
  const filtered = canDo.length > 0 || filter !== "everyone";
  const others = useMemo(
    () => (listQuery.data ?? []).filter((v) => !v.isMine).map(fromView),
    [listQuery.data],
  );
  const mine = useMemo(() => (myCard ? fromView(myCard) : null), [myCard]);
  const everyone = useMemo(
    () => (mine && visible ? [mine, ...others] : others),
    [mine, visible, others],
  );
  // Your own card is pinned first, outside search and filters.
  const shown = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return others
      .filter((p) =>
        filter === "solo" ? !p.needs : filter === "groups" ? !!p.needs : true,
      )
      .filter((p) =>
        canDo.every((c) =>
          c === FIRST ? p.firstHackathon : p.skills.includes(c),
        ),
      )
      .map((p) => {
        if (!q) return { p, rank: 0 };
        if (p.skills.some((s) => s.toLowerCase().includes(q)))
          return { p, rank: 0 };
        const text = [p.name, p.lookingFor, p.idea ?? "", p.school ?? ""];
        return {
          p,
          rank: text.some((t) => t.toLowerCase().includes(q)) ? 1 : 2,
        };
      })
      .filter(({ rank }) => rank < 2)
      .sort((a, b) => a.rank - b.rank)
      .map(({ p }) => p);
  }, [others, filter, deferredQuery, canDo]);
  // Your card (or the make-card slot) is always first, so others fill the rest
  // of each 24-card page and rows stay full at 3 and 2 columns. Organizers
  // have no slot.
  const page = shown.slice(0, limit - (organizer ? 0 : 1));
  const total = shown.length + (visible ? 1 : 0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const more = page.length < shown.length;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !more) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setLimit((n) => n + PAGE_SIZE);
      },
      { rootMargin: "0px 0px 800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
    // stage, loaded: the sentinel only exists once the board is showing.
  }, [more, page.length, stage, loaded]);
  const groups = everyone.filter((p) => p.needs).length;
  const early = others.length === 0;
  const cardReady = card ? isReady(card) : false;
  const canShowCard = cardReady && !blocked;

  const pill = `rounded-full px-3 py-1 text-sm font-semibold ${FOCUS}`;
  const accentPill = `${pill} bg-[#7a4aa3] text-white hover:bg-[#673d8c]`;
  const quietPill = `${pill} text-medium ring-1 ring-gray-2 hover:text-heavy`;
  const makeCardButton = (
    <button type="button" onClick={() => goTo("card")} className={accentPill}>
      Make your card
    </button>
  );
  // Managing your card happens on your card: one fixed-height row, the same
  // shape shown or hidden (fixed-width Show/Hide), so toggling never moves anything. `where` keeps ids
  // unique (the grid and the phone list are both in the page).
  const ownBar = (where: string) =>
    card && (
      <>
        <span className="mr-auto whitespace-nowrap text-[13px] font-semibold text-[#7a4aa3]">
          You · {blocked ? "Hidden by us" : visible ? "Shown" : "Hidden"}
        </span>
        {/* Fixed width, so "Show" and "Hide" take the same box. */}
        <button
          type="button"
          aria-describedby={canShowCard ? undefined : `own-not-ready-${where}`}
          disabled={!canShowCard}
          onClick={() => setShown.mutate({ shown: !visible })}
          aria-label={visible ? "Hide my card" : "Show my card"}
          className={`w-16 shrink-0 text-center disabled:cursor-not-allowed ${visible ? quietPill : `${accentPill} disabled:bg-[#7a4aa3]/45 disabled:hover:bg-[#7a4aa3]/45`}`}
        >
          {visible ? "Hide" : "Show"}
        </button>
        {!canShowCard && (
          <span id={`own-not-ready-${where}`} className="sr-only">
            {blocked
              ? "An organizer hid your card."
              : "Add who would fit your team and a way to message you first."}
          </span>
        )}
        <button
          type="button"
          aria-label={cardReady ? "Edit my card" : "Finish my card"}
          onClick={() => goTo("card")}
          className={`shrink-0 ${quietPill}`}
        >
          {cardReady ? "Edit" : "Finish"}
        </button>
      </>
    );
  // Organizers: hide a card from hackers, or undo it.
  const organizerBar = (p: Hacker) => {
    const hidden = !!p.hiddenByOrganizer;
    return (
      <>
        <span className="mr-auto whitespace-nowrap text-[13px] font-semibold text-[#7a4aa3]">
          {hidden ? "Hidden" : ""}
        </span>
        <button
          type="button"
          onClick={() =>
            (hidden ? unhideCard : hideCard).mutate({ cardId: p.id! })
          }
          aria-label={`${hidden ? "Unhide" : "Hide"} ${p.name}’s card`}
          className={`w-[72px] shrink-0 text-center ${hidden ? accentPill : quietPill}`}
        >
          {hidden ? "Unhide" : "Hide"}
        </button>
      </>
    );
  };
  // What each card in the list gets: Hide/Unhide for organizers, Report for hackers.
  const cardExtras = (p: Hacker) =>
    organizer
      ? {
          ownBar: organizerBar(p),
          muted: !!p.hiddenByOrganizer,
        }
      : { action: <ReportCard cardId={p.id!} /> };

  // The site's thin lavender scrollbar for the page, with a dark gutter so it
  // doesn't show a white strip beside the photo.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("scrollbar");
    html.style.backgroundColor = BACKDROP;
    for (const el of [html, document.body]) {
      el.style.scrollPaddingTop = "48px";
      el.style.scrollPaddingBottom = "64px";
    }
    return () => {
      html.classList.remove("scrollbar");
      html.style.backgroundColor = "";
      for (const el of [html, document.body]) {
        el.style.scrollPaddingTop = "";
        el.style.scrollPaddingBottom = "";
      }
    };
  }, []);
  const filterProps = {
    query,
    filter,
    canDo,
    onQuery: (v: string) => {
      setQuery(v);
      setLimit(PAGE_SIZE);
    },
    onFilter: (f: Filter) => {
      setFilter(f);
      setLimit(PAGE_SIZE);
    },
    onToggle: (c: string) => {
      setCanDo((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]));
      setLimit(PAGE_SIZE);
    },
  };

  return (
    <>
      <SEO title="Team finder" />
      <Head>
        <meta name="theme-color" content={BACKDROP} />
      </Head>
      <div className="relative min-h-screen w-full touch-manipulation overflow-x-clip font-figtree">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: BACKDROP }}
        />
        <div className="pointer-events-none fixed inset-x-0 top-0 z-20 -translate-y-[6px]">
          <FilmStrip />
        </div>
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 translate-y-[10px]">
          <FilmStrip />
        </div>

        <div
          className={`relative z-10 mx-auto w-full px-5 pb-28 sm:px-8 ${board ? "max-w-[1360px] pt-14 md:pt-16" : "max-w-6xl pt-14 md:pt-24"}`}
        >
          {/* Hidden until the data decides which step to show. */}
          <header
            className={`flex items-start gap-4 text-white sm:gap-5 ${open && !failed && !loaded ? "invisible" : ""}`}
          >
            <Link
              href="/"
              aria-label="Hack Western home"
              className={`mt-0.5 shrink-0 rounded-md transition-transform hover:-rotate-6 hover:scale-105 motion-reduce:transition-none motion-reduce:hover:transform-none ${FOCUS} focus-visible:ring-white focus-visible:ring-offset-transparent`}
            >
              <Image
                src="/shared/horse.svg"
                alt=""
                width={40}
                height={60}
                className={board ? "h-12 w-auto" : "h-[60px] w-auto"}
                priority
                draggable={false}
              />
            </Link>
            <div className={board ? "min-w-0" : "min-w-0 max-w-xl"}>
              <h1
                ref={headingRef}
                id="stage-h"
                tabIndex={-1}
                className={`text-balance font-cossetteTexte font-bold leading-[1.1] focus:outline-none ${board ? "text-[28px] sm:text-[34px]" : "text-[34px] sm:text-[48px]"}`}
              >
                {access === "closed"
                  ? "Team finder has closed"
                  : access === "not-open"
                    ? "Team finder opens when RSVPs close"
                    : !open
                      ? "Team finder is for confirmed hackers"
                      : failed
                        ? "Couldn’t load the team finder"
                        : stage === "card"
                          ? card
                            ? "Edit your card"
                            : "Make your card"
                          : "Find your team"}
              </h1>
              {(open || access === "not-open") && (
                <p
                  className={
                    board
                      ? "mt-1 text-[15px]"
                      : "mt-3 text-pretty text-[17px] leading-relaxed"
                  }
                >
                  {!open
                    ? `RSVPs close ${deadlineText}.`
                    : failed
                      ? "Refresh the page to try again."
                      : stage === "card"
                        ? `Other hackers see your card when they look for teammates. Teams can have up to ${TEAM_SIZE} people.`
                        : `Message anyone who looks like a fit. Teams can have up to ${TEAM_SIZE} people.`}
                </p>
              )}
              {access === "not-confirmed" && (
                <>
                  <p className="mt-3 text-pretty text-[17px] leading-relaxed">
                    It’s open to hackers who confirmed their spot for Hack
                    Western 13.
                    {email && (
                      <>
                        {" "}
                        You’re signed in as{" "}
                        <span className="font-semibold">{email}</span>.
                      </>
                    )}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <Button
                      asChild
                      variant="primary"
                      className="h-12 min-h-0 px-6 py-0 font-figtree font-medium"
                    >
                      <Link href="/dashboard">Go to your dashboard</Link>
                    </Button>
                    <button
                      type="button"
                      onClick={() =>
                        void signOut({
                          callbackUrl: "/login?callbackUrl=%2Fteam-finder",
                        })
                      }
                      className={`rounded-sm text-[15px] font-semibold underline underline-offset-4 hover:text-[#e1c8fa] ${FOCUS} focus-visible:ring-offset-transparent`}
                    >
                      Use a different account
                    </button>
                  </div>
                </>
              )}
              {stage === "card" && !card && !failed && (
                <button
                  type="button"
                  onClick={skip}
                  className={`mt-3 rounded-sm text-[15px] font-semibold underline underline-offset-4 hover:text-[#e1c8fa] ${FOCUS} focus-visible:ring-offset-transparent`}
                >
                  Just browsing? See who’s looking
                </button>
              )}
            </div>
          </header>

          {!open && <BoardTeaser />}

          {!loaded || failed ? null : stage === "card" ? (
            <CardStage
              initial={card ?? BLANK_CARD}
              isNew={!card}
              me={mineQuery.data!.prefill}
              blocked={blocked}
              photosOff={photosOff}
              onSave={save}
              onLeave={card ? () => goTo("board") : skip}
            />
          ) : (
            <div
              className={`mt-8 grid grid-cols-1 gap-8 lg:mt-12 lg:items-start lg:gap-10 ${early ? "" : "lg:grid-cols-[300px_1fr]"}`}
            >
              {/* Desktop: the filters, pinned as the list scrolls. */}
              {!early && (
                <div className="hidden lg:block lg:self-stretch">
                  <Filters variant="rail" {...filterProps} />
                </div>
              )}

              <section
                aria-labelledby="browse-h"
                className="flex flex-col gap-4"
              >
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
                  <div className="text-white">
                    <h2
                      id="browse-h"
                      tabIndex={-1}
                      className="scroll-mt-28 text-balance font-cossetteTexte text-2xl font-bold focus:outline-none"
                    >
                      Who’s looking
                    </h2>
                    {everyone.length > 0 && (
                      <p className="text-sm font-semibold tabular-nums">
                        {everyone.length}{" "}
                        {everyone.length === 1 ? "hacker" : "hackers"} so far
                        {groups > 0 && `, ${groups} of them in groups`}
                      </p>
                    )}
                  </div>
                </div>

                {photoNote && (
                  <p role="alert" className={`self-start ${PHOTO_NOTE}`}>
                    {photoNote}
                  </p>
                )}

                {!early && <Filters variant="inline" {...filterProps} />}

                <>
                  {/* Organizers have no card slot: no empty box when no one matches. */}
                  <ul
                    className={`divide-y divide-gray-1 overflow-hidden rounded-2xl bg-white text-heavy shadow-lg md:hidden ${organizer && page.length === 0 ? "hidden" : ""}`}
                  >
                    {mine ? (
                      <CompactRow
                        entry={mine}
                        you
                        muted={!visible}
                        ownBar={ownBar("row")}
                      />
                    ) : (
                      !organizer && (
                        <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                          <p className="min-w-0 flex-1 text-sm text-medium">
                            <span className="block font-semibold text-heavy">
                              No card yet
                            </span>
                            Add one so other hackers can find you.
                          </p>
                          {makeCardButton}
                        </li>
                      )
                    )}
                    {page.map((p) => (
                      <CompactRow key={p.id} entry={p} {...cardExtras(p)} />
                    ))}
                  </ul>
                  <div className="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-3">
                    {mine ? (
                      <EntryCard
                        entry={mine}
                        clamp
                        you
                        muted={!visible}
                        ownBar={ownBar("grid")}
                      />
                    ) : (
                      !organizer && (
                        <div className="flex flex-col items-start justify-center gap-2 rounded-xl border-2 border-dashed border-white/35 p-5 text-white">
                          <p className="font-cossetteTexte text-xl font-bold">
                            No card yet
                          </p>
                          <p className="text-sm text-white/75">
                            Add one so other hackers can find you.
                          </p>
                          <div className="mt-1">{makeCardButton}</div>
                        </div>
                      )
                    )}
                    {page.map((p) => (
                      <EntryCard
                        key={p.id}
                        entry={p}
                        clamp
                        {...cardExtras(p)}
                      />
                    ))}
                  </div>
                  {!early &&
                    (page.length < shown.length ? (
                      // Loads the next 24 well before the end of the list.
                      <div ref={sentinelRef} aria-hidden className="h-px" />
                    ) : (
                      <p className="pt-2 text-center text-sm text-white/70">
                        {total} {total === 1 ? "hacker" : "hackers"}
                      </p>
                    ))}
                </>

                {early ? (
                  <div className="rounded-2xl bg-white p-6 text-heavy shadow-lg">
                    <p className="font-semibold">You’re early</p>
                    <p className="mt-1 text-medium">
                      No one else has posted a card yet. Others will show up
                      here as they make theirs, so check back soon.
                    </p>
                  </div>
                ) : (
                  shown.length === 0 && (
                    <div className="rounded-2xl bg-white p-6 text-heavy shadow-lg">
                      <p className="font-semibold">
                        {query.trim()
                          ? `No one matches “${query.trim()}”${filtered ? " with these filters" : ""} yet.`
                          : "No one matches these filters yet."}
                      </p>
                      <p className="mt-1 text-medium">
                        {filtered
                          ? "Try fewer filters, or "
                          : "Try another word, or "}
                        <button
                          type="button"
                          onClick={() => {
                            setQuery("");
                            setCanDo([]);
                            setFilter("everyone");
                          }}
                          className={`rounded-sm font-semibold text-heavy underline underline-offset-4 ${FOCUS}`}
                        >
                          clear all filters
                        </button>
                        .
                      </p>
                    </div>
                  )
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: {
        destination: `/login?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const result = await getTeamFinderAccess(session.user.id);
  const access: Access = result.ok
    ? result.role
    : result.reason === "not-open" || result.reason === "closed"
      ? result.reason
      : "not-confirmed";
  return {
    props: {
      access,
      deadlineText: formatRsvpDeadline(),
      email: access === "not-confirmed" ? (session.user.email ?? null) : null,
    } satisfies TeamFinderProps,
  };
};
