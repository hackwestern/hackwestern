import { useCallback, useEffect, useRef, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import Link from "next/link";
import { ArrowRight, Check, ChevronLeft, CircleAlert, Clock } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import { sponsorSetupCopy as copy } from "~/content/sponsor-coffee-setup";
import { setupEvents, setupState } from "~/lib/coffee-chat-setup";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/utils/api";

export type SetupData = RouterOutputs["coffeeChatSetup"]["get"];

export const sessionLabel = (id: string) => copy.sessions[id] ?? id;

/** "14:00" -> "2:00" (no AM/PM: chat times are all daytime Saturday). */
export function shortClock(time: string): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`;
}

/** "Fri 9:52 PM", Eastern (the event's time zone). */
export function whenEastern(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  })
    .format(d)
    .replace(/\./g, "")
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM");
}

/** Minutes after midnight -> "HH:MM". */
export const clockOf = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const cardClass =
  "flex flex-col gap-4 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card sm:p-6";

/** When this device last opened this sponsor's coffee chats (per device). */
function useLastSeen(sponsor: string, ready: boolean): Date | null | undefined {
  const [lastSeen, setLastSeen] = useState<Date | null | undefined>(undefined);
  const key = `hw-coffee-setup-seen:${sponsor}`;
  useEffect(() => {
    if (!ready || lastSeen !== undefined) return;
    let prev: Date | null = null;
    try {
      const raw = window.localStorage.getItem(key);
      prev = raw ? new Date(raw) : null;
      window.localStorage.setItem(key, new Date().toISOString());
    } catch {
      prev = null;
    }
    setLastSeen(prev && !Number.isNaN(prev.getTime()) ? prev : null);
  }, [key, ready, lastSeen]);
  return lastSeen;
}

/**
 * Big, plain status at the top of every coffee chat screen: where things
 * stand, what changed (and who did it), whether they need to act, and
 * what happens next. Sponsors come back cold, hours after organizers act.
 */
export function SetupStatus({ sponsor, data }: { sponsor: string; data: SetupData }) {
  const lastSeen = useLastSeen(sponsor, true);
  const state = setupState({
    repCount: data.reps.length,
    updatedAt: data.updatedAt,
    submittedAt: data.submittedAt,
    confirmed: data.confirmed,
    seats: data.seats,
  });
  const events = setupEvents(data);
  const fresh = lastSeen ? events.filter((e) => e.at > lastSeen) : [];
  const shown = fresh.length ? fresh : events.slice(0, 1);
  const s = copy.status;
  const title =
    state.kind === "accepted" ? s.state.accepted(state.accepted, state.seats) : s.state[state.kind];
  const todo =
    state.kind === "notStarted"
      ? s.todo.notStarted
      : state.kind === "draft"
        ? s.todo.draft
        : state.kind === "waiting"
          ? data.shortlistSubmittedAt
            ? s.todo.waiting
            : s.todo.shortlist
          : s.todo.scheduled;
  const next =
    state.kind === "notStarted"
      ? s.next.notStarted
      : state.kind === "draft"
        ? s.next.draft
        : state.kind === "waiting"
          ? s.next.waiting
          : s.next.scheduled;
  const needsAction = state.kind === "notStarted" || state.kind === "draft";
  const done = state.kind === "invitesGoingOut" || state.kind === "accepted";

  return (
    <section
      aria-label={s.label}
      className={cn(
        "flex flex-col gap-3 rounded-dashboard-lg border-l-4 bg-dashboard-bg-surface p-4 shadow-dashboard-card sm:p-5",
        needsAction ? "border-dashboard-status-warning" : done ? "border-dashboard-status-live" : "border-dashboard-action-primary",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
            needsAction
              ? "bg-dashboard-status-iconBadge text-dashboard-text-warning"
              : done
                ? "bg-dashboard-status-live text-dashboard-text-inverse"
                : "bg-dashboard-bg-highlight text-dashboard-text-active",
          )}
        >
          {needsAction ? <CircleAlert className="size-5" /> : done ? <Check className="size-5" /> : <Clock className="size-5" />}
        </span>
        <p className="m-0 text-xl font-bold leading-snug text-dashboard-text-heavy sm:text-2xl">{title}</p>
      </div>
      {shown.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
            {fresh.length ? s.changes.since : s.changes.last}
          </span>
          {shown.map((e) => (
            <p key={e.kind} className="m-0 text-base text-dashboard-text-medium">
              {s.at(s.changes[e.kind] ?? e.kind, whenEastern(e.at))}
            </p>
          ))}
        </div>
      )}
      {data.editedAfterSend && (
        <p className="m-0 rounded-dashboard-md bg-dashboard-bg-task p-3 text-base text-dashboard-text-task">
          {s.editedAfterSend(data.seats.changed)}
        </p>
      )}
      <p className={cn("m-0 text-base font-semibold", needsAction ? "text-dashboard-text-warning" : "text-dashboard-text-heavy")}>
        {todo}
      </p>
      <p className="m-0 text-base text-dashboard-text-medium">{next}</p>
    </section>
  );
}

/** "Back to Chats" link at the top of a flow. */
export function BackToChats({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 w-fit items-center gap-1 rounded-dashboard-md px-1 text-base font-semibold text-dashboard-text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
        pressable,
      )}
    >
      <ChevronLeft aria-hidden className="size-5" />
      {copy.back}
    </Link>
  );
}

/** The flow's header card plus its numbered step rail. */
export function FlowHeader({
  tag,
  title,
  body,
  steps,
  current,
  hrefFor,
}: {
  tag: string;
  title: string;
  body: string;
  steps: readonly string[];
  /** 1-based. */
  current: number;
  hrefFor: (step: number) => string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-dashboard-lg border-l-4 border-dashboard-action-primary bg-dashboard-bg-highlight px-4 py-4 sm:px-6">
        <span className="text-xs font-bold uppercase tracking-wider text-dashboard-text-active">{tag}</span>
        <h1 className="dashboard-h1 m-0 text-dashboard-text-active">{title}</h1>
        <p className="m-0 text-base text-dashboard-text-medium">{body}</p>
      </div>
      <nav aria-label={copy.rail.label} className="flex flex-col gap-2">
        <span className="text-sm text-dashboard-text-medium">{copy.rail.stepOf(current, steps.length)}</span>
        <ol className="m-0 grid list-none gap-2 p-0" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((label, i) => {
            const n = i + 1;
            const href = hrefFor(n);
            const state = n < current ? "done" : n === current ? "current" : "todo";
            const inner = (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-full rounded-full",
                    state === "todo" ? "bg-dashboard-bg-nav" : "bg-dashboard-action-primary",
                  )}
                />
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      state === "todo"
                        ? "border border-dashboard-border-control text-dashboard-text-light"
                        : "bg-dashboard-action-primary text-dashboard-text-inverse",
                    )}
                  >
                    {state === "done" ? <Check className="size-3" /> : n}
                  </span>
                  <span
                    className={cn(
                      "hidden text-sm sm:inline",
                      state === "current" ? "font-semibold text-dashboard-text-active" : "text-dashboard-text-medium",
                    )}
                  >
                    {label}
                  </span>
                  <span className="sr-only sm:hidden">{label}</span>
                  {state !== "todo" && (
                    <span className="sr-only">, {state === "done" ? copy.rail.done : copy.rail.current}</span>
                  )}
                </span>
              </>
            );
            return (
              <li key={label} aria-current={state === "current" ? "step" : undefined}>
                {href && state !== "current" ? (
                  <Link href={href} className="flex min-h-11 flex-col gap-1.5 rounded-dashboard-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex min-h-11 flex-col gap-1.5">{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
        <p className="m-0 text-base font-semibold text-dashboard-text-heavy sm:hidden">{steps[current - 1]}</p>
      </nav>
    </div>
  );
}

/** Back + primary action at the bottom of a step. */
export function StepFooter({
  back,
  primary,
  note,
}: {
  back?: React.ReactNode;
  primary: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-dashboard-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="order-2 sm:order-1">{back}</div>
      <div className="order-1 flex flex-col gap-2 sm:order-2 sm:flex-row sm:items-center sm:gap-4">
        {note && <p className="m-0 text-sm text-dashboard-text-medium sm:text-right">{note}</p>}
        {primary}
      </div>
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
}) {
  return (
    <DashboardButton asChild variant={variant} className={cn("min-h-11 md:h-11", pressable)}>
      <Link href={href}>
        {children}
        {variant === "primary" && <ArrowRight aria-hidden />}
      </Link>
    </DashboardButton>
  );
}

/**
 * Once invites are out, every change asks first ("Invites are already
 * out…"). `guard(run, affected)` calls run(false) before Send, or opens the
 * warning and calls run(true) when they choose Change anyway. `affected` is
 * the invited hackers in the chats this change touches (invitesAffected).
 */
export function useAfterInvites(data: SetupData | undefined) {
  const [pending, setPending] = useState<{ run: (confirm: boolean) => void; affected: number } | null>(null);
  // Agreed once on this screen: don't ask again for every tick.
  const agreed = useRef(false);
  const guard = useCallback(
    (run: (confirm: boolean) => void, affected = 0) => {
      if (!data?.confirmed) return run(false);
      if (agreed.current) return run(true);
      setPending({ run, affected });
    },
    [data?.confirmed],
  );
  const dialog = (
    <AlertDialog.Root open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-dashboard-lg bg-dashboard-bg-surface p-6 font-figtree shadow-dashboard-card">
          <AlertDialog.Title className="m-0 text-xl font-bold text-dashboard-text-heavy">
            {copy.afterInvites.title}
          </AlertDialog.Title>
          <AlertDialog.Description className="m-0 text-base text-dashboard-text-medium">
            {copy.afterInvites.body(pending?.affected ?? 0)}
          </AlertDialog.Description>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <AlertDialog.Action asChild>
              <DashboardButton
                className={cn("min-h-11", pressable)}
                onClick={() => {
                  agreed.current = true;
                  pending?.run(true);
                  setPending(null);
                }}
              >
                {copy.afterInvites.confirm}
              </DashboardButton>
            </AlertDialog.Action>
            <AlertDialog.Cancel asChild>
              <DashboardButton variant="outline" className={cn("h-11", pressable)}>
                {copy.afterInvites.cancel}
              </DashboardButton>
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
  return { guard, dialog };
}

/** Screen reader announcements (a polite live region). */
export function useAnnounce() {
  const [message, setMessage] = useState("");
  const announce = useCallback((text: string) => {
    setMessage("");
    requestAnimationFrame(() => setMessage(text));
  }, []);
  const region = (
    <p role="status" className="sr-only">
      {message}
    </p>
  );
  return { announce, region };
}
