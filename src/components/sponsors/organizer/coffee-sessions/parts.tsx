import { useEffect, useState } from "react";
import { Check, Copy, Crown } from "lucide-react";
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
        title={name}
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
      title={name}
      className={cn(
        "block w-auto max-w-full shrink-0 object-contain object-left",
        size === "sm" ? "h-4 max-w-[84px]" : "h-5 max-w-[100px]",
        className,
      )}
    />
  );
}

export function PrimaryCrown() {
  return (
    <span
      role="img"
      aria-label={copy.phone.primary}
      title={copy.phone.primary}
      className="inline-flex text-dashboard-border-task"
    >
      <Crown aria-hidden className="size-4 fill-current" strokeWidth={1.5} />
    </span>
  );
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
