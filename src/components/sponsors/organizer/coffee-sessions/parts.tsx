import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { PrimaryCrownIcon } from "~/components/sponsors/organizer/primary-crown";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import { sponsorLogo } from "~/lib/sponsor-logos";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/utils/api";

// Shared pieces of the organizer coffee chat board (mocks/organizer-coffee-v8).

export type SessionBoardData = RouterOutputs["coffeeChatSessions"]["getBoard"];
export type BoardSponsor = SessionBoardData["sponsors"][number];
export type BoardRep = BoardSponsor["reps"][number];
export type BoardFix = SessionBoardData["fixes"][number];

const copy = coffeeSessionsCopy;

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-1";

/** Hatched fill for workshop windows ("their event"). */
export const hatch =
  "bg-[repeating-linear-gradient(135deg,theme(colors.dashboard.border.subtle)_0_3px,theme(colors.dashboard.bg.surface)_3px_8px)]";

export const sessionLabel = (id: string) => copy.sessions[id] ?? id;

/**
 * The red primary button of a warning (moving or removing something that
 * tells hackers, or a rep who isn't free): Tailwind's existing destructive
 * colours on a primary DashboardButton (white on destructive-dark, about
 * 4.8:1; hover #b42318, the notice danger token). DashboardButton itself has
 * no red variant (shared component).
 */
export const dangerButton =
  "bg-destructive-dark text-dashboard-text-inverse shadow-none hover:bg-dashboard-notice-danger disabled:hover:bg-destructive-dark focus-visible:ring-destructive-dark";

/** The Sent or Draft dot after a rep's name (the word for screen readers and the tooltip). */
export function StatusDot({ sent }: { sent: boolean }) {
  const word = sent ? copy.rooms.tagSent : copy.rooms.tagDraft;
  return (
    <span
      data-tip={word}
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center",
        sent ? "text-dashboard-status-live" : "text-dashboard-text-light",
      )}
    >
      <span
        aria-hidden
        className={cn("size-2 rounded-full", sent ? "bg-current" : "shadow-[inset_0_0_0_1.5px_currentColor]")}
      />
      <span className="sr-only">{word}</span>
    </span>
  );
}

/**
 * One tooltip for the board (dark, 13px) on anything with data-tip: logos
 * and the Sent or Draft dots. Hover shows it; on touch a 450 ms press shows
 * it for 1.6 s, except inside a draggable cell (that press starts a drag).
 */
export function BoardTips({ off }: { off: boolean }) {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const offRef = useRef(off);
  offRef.current = off;
  useEffect(() => {
    if (off) setTip(null);
  }, [off]);
  useEffect(() => {
    const at = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      setTip({ text: el.dataset.tip ?? "", x: r.left + r.width / 2, y: r.top });
    };
    const over = (e: MouseEvent) => {
      if (offRef.current) return;
      const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-tip]");
      if (el) at(el);
      else setTip(null);
    };
    let press: ReturnType<typeof setTimeout> | undefined;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const touch = (e: TouchEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-tip]");
      if (!el || el.closest("[data-drag]")) return;
      press = setTimeout(() => {
        at(el);
        hide = setTimeout(() => setTip(null), 1600);
      }, 450);
    };
    const cancel = () => clearTimeout(press);
    const hideNow = () => setTip(null);
    document.addEventListener("mouseover", over);
    document.addEventListener("touchstart", touch, { passive: true });
    for (const ev of ["touchend", "touchmove", "scroll"] as const) {
      document.addEventListener(ev, cancel, { passive: true, capture: true });
    }
    window.addEventListener("scroll", hideNow, { passive: true, capture: true });
    return () => {
      clearTimeout(press);
      clearTimeout(hide);
      document.removeEventListener("mouseover", over);
      document.removeEventListener("touchstart", touch);
      for (const ev of ["touchend", "touchmove", "scroll"] as const) {
        document.removeEventListener(ev, cancel, { capture: true });
      }
      window.removeEventListener("scroll", hideNow, { capture: true });
    };
  }, []);
  // Above the element, kept 8px inside the window.
  const boxRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || !tip) return;
    const w = el.offsetWidth;
    el.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, tip.x - w / 2))}px`;
    el.style.top = `${Math.max(8, tip.y - el.offsetHeight - 6)}px`;
  }, [tip]);
  if (!tip) return null;
  return (
    <div
      ref={boxRef}
      role="tooltip"
      className="pointer-events-none fixed left-0 top-0 z-[70] whitespace-nowrap rounded-dashboard-md bg-dashboard-text-heavy px-2 py-1 text-[13px] font-medium text-dashboard-text-inverse shadow-dashboard-card"
    >
      {tip.text}
    </div>
  );
}

/** Minutes after midnight -> "1:30" (no AM/PM: the board is daytime). */
export function clockOf(min: number): string {
  const h = Math.floor(min / 60);
  return `${h > 12 ? h - 12 : h}:${String(min % 60).padStart(2, "0")}`;
}

/** "5195550101" -> "(519) 555-0101"; anything else as typed. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : phone;
}

/** The sponsor's logo (name as alt and tooltip), or a text wordmark. */
export function Logo({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const src = sponsorLogo(name);
  if (!src) {
    return (
      <span
        role="img"
        aria-label={name}
        data-tip={name}
        className={cn(
          "inline-flex min-w-0 items-center font-extrabold leading-none tracking-wide text-dashboard-text-heavy",
          size === "sm" ? "text-[13px]" : "text-[15px]",
          className,
        )}
      >
        {name}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      data-tip={name}
      className={cn(
        "block w-auto max-w-full shrink-0 object-contain object-left",
        size === "sm" ? "h-4 max-w-[84px]" : "h-5 max-w-[100px]",
        className,
      )}
    />
  );
}

export function PrimaryCrown() {
  return <PrimaryCrownIcon label={copy.phone.primary} />;
}

const STATUS_STYLE: Record<BoardSponsor["status"]["kind"], string> = {
  not: "border border-dashed border-dashboard-border-task text-dashboard-text-warning",
  none: "bg-dashboard-bg-inset text-dashboard-text-medium",
  unavailable: "border border-dashed border-dashboard-border-task text-dashboard-text-warning",
  need: "bg-dashboard-bg-task text-dashboard-text-task",
  scheduled: "bg-dashboard-bg-nav text-dashboard-text-active",
  sent: "bg-dashboard-schedule-green text-dashboard-status-live",
};

export function statusText(status: BoardSponsor["status"]): string {
  return copy.sponsors.status[status.kind];
}

/**
 * Problems shown beside the stage chip: chats that break a rule now, else
 * reps who want chats and have none ("1 rep short of chats"). A sponsor with
 * nothing placed yet shows only its stage, "Needs scheduling".
 */
export function statusFlags(status: BoardSponsor["status"]): string[] {
  if (!("done" in status) || status.kind === "need") return [];
  const f = copy.sponsors.flags;
  if (status.broken > 0) return [f.broken(status.broken)];
  return status.done < status.total ? [f.notPlaced(status.total - status.done)] : [];
}

export function StatusChip({ status }: { status: BoardSponsor["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center whitespace-nowrap rounded-dashboard-md px-2 py-0.5 text-[13px] font-semibold leading-tight",
        STATUS_STYLE[status.kind],
      )}
    >
      {statusText(status)}
    </span>
  );
}

/**
 * A phone number with a copy icon beside it (44 px target). The icon turns
 * into a check and "Copied" shows for a moment; screen readers hear it too.
 */
export function PhoneCopy({ name, phone }: { name: string; phone: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  const shown = formatPhone(phone);
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="text-[13px] tabular-nums text-dashboard-text-medium">{shown}</span>
      <button
        type="button"
        aria-label={copied ? copy.phone.copiedLabel(shown) : copy.phone.copyLabel(name, shown)}
        onClick={() => {
          const done = () => setCopied(true);
          void navigator.clipboard?.writeText(shown).then(done, done);
        }}
        className={cn(
          "inline-flex size-11 shrink-0 cursor-pixel-hover items-center justify-center rounded-dashboard-md text-dashboard-text-light [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
          focusRing,
        )}
      >
        {copied ? (
          <Check aria-hidden className="size-4 text-dashboard-status-live" />
        ) : (
          <Copy aria-hidden className="size-4" />
        )}
      </button>
      <span aria-live="polite" className="text-[13px] font-medium text-dashboard-status-live">
        {copied ? copy.phone.copied : ""}
      </span>
    </span>
  );
}

/**
 * A sponsor's reps, primary first: name (+ crown), how many chats they
 * asked for, and their phone with a copy icon. No Text or Call buttons.
 */
export function PeopleList({ sponsor }: { sponsor: BoardSponsor }) {
  const reps = [...sponsor.reps].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  return (
    <ul aria-label={copy.sponsors.people} className="m-0 flex list-none flex-col gap-1 p-0">
      {reps.map((r) => (
        <li key={r.id} className="flex min-w-0 flex-col py-1">
          <b className="inline-flex flex-wrap items-center gap-1 text-[15px] font-semibold [overflow-wrap:anywhere]">
            {r.name}
            {r.isPrimary && <PrimaryCrown />}
          </b>
          {sponsor.submitted && (
            <span className="text-[13px] text-dashboard-text-light">
              {copy.sponsors.asked(copy.sponsors.repWants(r.chatsWanted, sponsor.chatMinutes))}
            </span>
          )}
          <PhoneCopy name={r.name} phone={r.phone} />
        </li>
      ))}
    </ul>
  );
}

/** Card shell matching the dashboard's white panels. */
export function Card({
  children,
  className,
  labelledBy,
  tour,
}: {
  children: React.ReactNode;
  className?: string;
  labelledBy: string;
  tour?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      data-tour={tour}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-5 shadow-dashboard-card md:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHead({ id, title, aside }: { id: string; title: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="m-0 text-xl font-bold text-dashboard-text-heavy">
        {title}
      </h2>
      {aside && <span className="text-sm text-dashboard-text-light">{aside}</span>}
    </div>
  );
}
