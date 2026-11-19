import { useEffect, useState } from "react";
import { Check, Crown } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
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
export const firstName = (name: string) => name.split(" ")[0] ?? name;

/** "5195550101" -> "(519) 555-0101"; anything else as typed. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : phone;
}
export function telOf(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `+1${d}` : `+${d}`;
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
      aria-label={copy.contact.primary}
      title={copy.contact.primary}
      className="inline-flex text-dashboard-border-task"
    >
      <Crown aria-hidden className="size-4 fill-current" strokeWidth={1.5} />
    </span>
  );
}

const STATUS_STYLE: Record<BoardSponsor["status"]["kind"], string> = {
  not: "border border-dashed border-dashboard-border-task text-dashboard-text-warning",
  need: "bg-dashboard-bg-task text-dashboard-text-task",
  scheduled: "bg-dashboard-bg-nav text-dashboard-text-active",
  sent: "bg-dashboard-schedule-green text-dashboard-status-live",
};

export function statusText(status: BoardSponsor["status"]): string {
  const s = copy.sponsors.status;
  switch (status.kind) {
    case "not":
      return s.not;
    case "sent":
      return s.sent;
    case "scheduled":
      return s.scheduled(status.done, status.total);
    case "need":
      return s.need(status.done, status.total);
  }
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
 * Everyone to contact at a sponsor, primary first: name (+ crown) and phone
 * on the left, Copy / Text / Call in one fixed column on the right. Text
 * opens Messages with `draft` filled in; Copy stays for laptops where sms:
 * does nothing.
 */
export function ContactList({
  sponsor,
  draft,
}: {
  sponsor: BoardSponsor;
  draft: (first: string) => string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  const reps = [...sponsor.reps].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
      {reps.map((r) => {
        const phone = formatPhone(r.phone);
        const body = encodeURIComponent(draft(firstName(r.name)));
        return (
          <li
            key={r.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-1.5"
          >
            <div className="min-w-0">
              <b className="inline-flex flex-wrap items-center gap-1 text-[15px] font-semibold [overflow-wrap:anywhere]">
                {r.name}
                {r.isPrimary && <PrimaryCrown />}
              </b>
              <span className="block text-[13px] tabular-nums text-dashboard-text-light">
                {phone}
              </span>
            </div>
            <div className="flex flex-nowrap gap-0.5">
              <DashboardButton
                variant="link"
                className="min-w-[66px] px-2"
                aria-label={copied === r.id ? copy.contact.copiedLabel(phone) : undefined}
                onClick={() => {
                  const done = () => setCopied(r.id);
                  void navigator.clipboard?.writeText(phone).then(done, done);
                }}
              >
                {copied === r.id ? (
                  <>
                    <Check aria-hidden className="text-dashboard-status-live" />
                    {copy.contact.copied}
                  </>
                ) : (
                  copy.contact.copy
                )}
              </DashboardButton>
              <DashboardButton variant="link" className="px-2" asChild>
                <a href={`sms:${telOf(r.phone)}?&body=${body}`}>{copy.contact.text}</a>
              </DashboardButton>
              <DashboardButton variant="link" className="px-2" asChild>
                <a href={`tel:${telOf(r.phone)}`}>{copy.contact.call}</a>
              </DashboardButton>
            </div>
          </li>
        );
      })}
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
