import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Info, ScanLine } from "lucide-react";
import { btn, card } from "~/components/sponsors/portal-ui";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import {
  sponsorHomeCopy,
  type AgendaAction,
  type AgendaStep,
} from "~/content/sponsor-home";
import {
  clockTime,
  eventClock,
  planDay,
  stateOf,
  stepsFor,
  type HomeContext,
  type StepState,
} from "~/lib/sponsor-home";
import { IveyWalkNote } from "~/components/ivey-walk-note";
import { cn } from "~/lib/utils";
import { readStored, writeStored } from "./welcome-card";

const copy = sponsorHomeCopy.upNext;
const LESS_KEY = "hw-sponsor-upnext";

/** "Fri Nov 20 · 6:00 PM", Eastern. */
function clockLabel(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return copy.clock(
    `${get("weekday")} ${get("month")} ${get("day")}`,
    `${get("hour")}:${get("minute")} ${get("dayPeriod")}`,
  );
}

const quietBtn =
  "inline-flex min-h-11 items-center gap-1 self-start rounded-dashboard-md px-1 text-sm font-semibold text-dashboard-text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:bg-dashboard-bg-highlight";

/**
 * Home's Up next (mock sponsor-chats-v3, from sponsor-today-v4): today's
 * steps as a timeline, the one happening now (or next) highlighted with its
 * button, done steps faded with a tick. "Earlier" and "Look ahead" open the
 * other days. The chevron shows just the highlighted step; that choice is
 * remembered on this device.
 */
export function UpNext({
  ctx,
  now,
  hrefs,
  mapHref,
}: {
  ctx: HomeContext;
  now: Date;
  hrefs: Record<AgendaAction, string>;
  /** The portal map opened on Ivey, for the Ivey walk note's Check map. */
  mapHref?: string;
}) {
  const [less, setLess] = useState(false);
  const [earlier, setEarlier] = useState(false);
  const [ahead, setAhead] = useState(false);
  useEffect(() => setLess(readStored(LESS_KEY) === "less"), []);
  const { abs, day } = eventClock(now);
  const { rows, hi, mode, next } = planDay(day, abs, ctx);
  const label = (step: AgendaStep) => {
    if (hi && step === hi.step) {
      return mode === "now" ? (
        <Label now>{copy.now}</Label>
      ) : (
        <Label>{copy.nextIn(day * 1440 + step.start - abs)}</Label>
      );
    }
    if (next && step === next.step) return <Label>{copy.next}</Label>;
    return null;
  };

  return (
    <section
      aria-labelledby="upnext-heading"
      data-tour="home-upnext"
      className={card}
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          id="upnext-heading"
          className="m-0 text-[22px] font-semibold md:text-2xl"
        >
          {copy.title}
        </h2>
        <div className="flex items-center gap-2">
          <p className="m-0 mt-0.5 whitespace-nowrap text-[15px] font-semibold tabular-nums text-dashboard-text-medium">
            {clockLabel(now)}
          </p>
          <button
            type="button"
            aria-expanded={!less}
            aria-controls="upnext-body"
            aria-label={less ? copy.showAll : copy.showLess}
            onClick={() => {
              const v = !less;
              setLess(v);
              writeStored(LESS_KEY, v ? "less" : "all");
            }}
            className={cn(
              quietBtn,
              "-mr-1 -mt-2 min-w-11 justify-center px-2",
              pressable,
            )}
          >
            <ChevronDown
              aria-hidden
              className={cn(
                "size-4 transition-transform duration-200",
                !less && "rotate-180",
              )}
            />
          </button>
        </div>
      </div>
      <div id="upnext-body" className="flex min-w-0 flex-col gap-3">
        {less ? (
          hi ? (
            <ol className="m-0 flex list-none flex-col p-0">
              <Row
                step={hi.step}
                state={hi.state}
                highlight
                label={label(hi.step)}
                hrefs={hrefs}
                mapHref={mapHref}
              />
            </ol>
          ) : (
            <p className="m-0 text-base text-dashboard-text-medium">
              {copy.allSet}
            </p>
          )
        ) : (
          <>
            {day > 0 && (
              <More
                id="upnext-earlier"
                label={copy.earlier}
                open={earlier}
                onToggle={() => setEarlier((v) => !v)}
                quiet
              >
                {([0, 1] as const)
                  .filter((d) => d < day)
                  .map((d) => (
                    <DayBlock key={d} day={d} abs={abs} ctx={ctx} />
                  ))}
              </More>
            )}
            <ol className="m-0 flex list-none flex-col p-0">
              {rows.map((r) => (
                <Row
                  key={r.step.id}
                  step={r.step}
                  state={r.state}
                  highlight={hi?.step === r.step}
                  label={label(r.step)}
                  hrefs={hrefs}
                  mapHref={mapHref}
                />
              ))}
            </ol>
            {!hi && (
              <p className="m-0 text-base text-dashboard-text-medium">
                {copy.allSet}
              </p>
            )}
            {day < 2 && (
              <div className="border-t border-dashboard-border-subtle pt-2">
                <More
                  id="upnext-ahead"
                  label={copy.ahead}
                  open={ahead}
                  onToggle={() => setAhead((v) => !v)}
                >
                  {([1, 2] as const)
                    .filter((d) => d > day)
                    .map((d) => (
                      <DayBlock key={d} day={d} abs={abs} ctx={ctx} />
                    ))}
                </More>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Label({
  now = false,
  children,
}: {
  now?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center self-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide",
        now
          ? "bg-dashboard-action-primary text-dashboard-text-inverse"
          : "border-[1.5px] border-dashboard-action-primary bg-dashboard-bg-surface text-dashboard-text-active",
      )}
    >
      {children}
    </span>
  );
}

function More({
  id,
  label,
  open,
  onToggle,
  quiet = false,
  children,
}: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  quiet?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className={cn(
          quietBtn,
          quiet && "font-medium text-dashboard-text-light",
          pressable,
        )}
      >
        {label}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </div>
  );
}

function DayBlock({
  day,
  abs,
  ctx,
}: {
  day: 0 | 1 | 2;
  abs: number;
  ctx: HomeContext;
}) {
  const d = copy.days[day];
  return (
    <>
      <h3 className="mx-2 mb-0.5 mt-2.5 text-[13px] font-bold uppercase tracking-wide text-dashboard-text-light">
        {copy.dayHeading(d.name, d.date)}
      </h3>
      <ol className="m-0 flex list-none flex-col p-0">
        {stepsFor(day, ctx).map((step) => (
          <Row
            key={step.id}
            step={step}
            state={stateOf(step, abs, ctx)}
            compact
          />
        ))}
      </ol>
    </>
  );
}

function timeOf(step: AgendaStep): React.ReactNode {
  if (step.note) return copy.allDay;
  if (step.by) return copy.by(clockTime(step.end));
  return (
    <>
      {clockTime(step.start)}
      {step.range && (
        <small className="block text-xs font-medium text-dashboard-text-light">
          {copy.to(clockTime(step.end))}
        </small>
      )}
      {step.due !== undefined && (
        <small className="block text-xs font-medium text-dashboard-text-light">
          {copy.due(clockTime(step.due))}
        </small>
      )}
    </>
  );
}

function Row({
  step,
  state,
  highlight = false,
  label = null,
  hrefs,
  mapHref,
  compact = false,
}: {
  step: AgendaStep;
  state: StepState;
  highlight?: boolean;
  label?: React.ReactNode;
  hrefs?: Record<AgendaAction, string>;
  mapHref?: string;
  compact?: boolean;
}) {
  const done = state === "done";
  const action = hrefs && step.action && !done ? step.action : null;
  return (
    <li
      aria-current={highlight ? "step" : undefined}
      className={cn(
        "group/row relative grid grid-cols-[72px_18px_minmax(0,1fr)] gap-x-2.5 rounded-dashboard-lg px-2 md:grid-cols-[84px_18px_minmax(0,1fr)] md:gap-x-3.5 md:px-3",
        compact ? "py-[7px]" : "py-2.5 md:py-3",
        highlight && "bg-dashboard-bg-checklistCurrent",
        done && "opacity-50",
      )}
    >
      <span
        className={cn(
          "pt-0.5 text-sm font-semibold tabular-nums leading-snug",
          highlight
            ? "text-dashboard-text-active"
            : "text-dashboard-text-medium",
        )}
      >
        {timeOf(step)}
      </span>
      <span aria-hidden className="relative flex justify-center">
        <span className="absolute inset-y-[-12px] left-1/2 w-0.5 -translate-x-1/2 bg-dashboard-border-subtle group-first/row:top-3 group-last/row:bottom-auto group-last/row:h-3 group-only/row:hidden" />
        <span
          className={cn(
            "relative z-[1] mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 bg-dashboard-bg-surface",
            done
              ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse"
              : step.note
                ? "border-dashed border-dashboard-border-control bg-dashboard-bg-inset text-dashboard-text-light"
                : highlight
                  ? "border-dashboard-action-primary shadow-[0_0_0_4px_theme(colors.dashboard.action.halo)]"
                  : "border-dashboard-border-control",
          )}
        >
          {done ? (
            <Check className="size-[11px]" strokeWidth={3.2} />
          ) : step.note ? (
            <Info className="size-3" strokeWidth={2.4} />
          ) : highlight ? (
            <span className="size-2 rounded-full bg-dashboard-action-primary" />
          ) : null}
        </span>
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-[1_1_200px]">
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 leading-snug">
            {label}
            <b
              className={cn(
                compact ? "text-[15px]" : "text-base",
                highlight
                  ? "text-[17px] font-bold"
                  : done || step.note
                    ? "font-medium"
                    : "font-semibold",
              )}
            >
              {step.title}
            </b>
            {step.where && (
              <span className="text-sm text-dashboard-text-light">
                {step.where}
              </span>
            )}
          </p>
          {step.sub && (
            <p className="m-0 mt-0.5 text-[13px] text-dashboard-text-light">
              {step.sub}
            </p>
          )}
          {step.ivey && (
            <IveyWalkNote
              who="sponsor"
              mapHref={mapHref ?? null}
              className="mt-1"
            />
          )}
        </div>
        {action && hrefs && (
          <Link
            href={hrefs[action]}
            // The tour points at the first one on the page.
            data-tour="home-upnext-action"
            className={cn(highlight ? btn.primary : btn.outline, btn.sm)}
          >
            {action === "scan" && <ScanLine aria-hidden />}
            {copy.actions[action]}
          </Link>
        )}
        {done && <span className="sr-only">{copy.done}</span>}
      </div>
    </li>
  );
}
