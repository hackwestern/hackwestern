import { useRef, useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { hover, press } from "~/components/internals/interaction";
import { SponsorLogo } from "~/components/sponsors/organizer/day-cells";
import { PrimaryCrownIcon } from "~/components/sponsors/organizer/primary-crown";
import { PhoneCopy } from "~/components/sponsors/phone-copy";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import { formatClock, type WorkshopInfo } from "~/lib/run-of-show";
import { round1State } from "~/lib/sponsor-day-board";
import {
  pillDone,
  type MySponsorChats,
  type SponsorRep,
  type SponsorSummary,
  type StatusPill,
} from "~/lib/sponsor-organizer";
import { hasPrizeTrack } from "~/lib/sponsor-prize-tracks";
import { cn } from "~/lib/utils";

const copy = sponsorOrganizerCopy.mine;
const dayCopy = sponsorOrganizerCopy.day;

/** A sponsor on My sponsors: the sheet row's fields this view reads. */
export type MySponsor = {
  name: string;
  sponsorId: string | null;
  status: string;
  boothLocation: string;
  /** False when the sheet didn't load (status unknown). */
  fromSheet: boolean;
};

export type MySponsorData = { reps: SponsorRep[]; chats: MySponsorChats };

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-1";

/** "Fri 6:12 PM", Eastern. */
function dayTime(at: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  })
    .format(new Date(at))
    .replace(/,/g, "");
}

/**
 * The sponsors the signed-in organizer leads, one logo tab each, and the
 * picked sponsor as stacked two-column tables (mock organizer-my-sponsors-v3):
 * People (coffee chat reps, crown on the primary, phone with a copy icon),
 * Logistics (Arrival and Booth as tap-to-advance pills, portal link,
 * coffee chat workshop, their workshop), Coffee chats, and Judging for
 * prize-track sponsors. No help requests (decisions 2026-11-19).
 */
export function MySponsors({
  sponsors,
  data,
  summaries,
  workshops,
  pending,
  onPill,
  copyLink,
}: {
  sponsors: MySponsor[];
  /** By sponsor id; undefined while loading. */
  data: Record<string, MySponsorData> | undefined;
  summaries: ReadonlyMap<string, SponsorSummary>;
  /** Run-of-show workshops; null when not loaded. */
  workshops: readonly WorkshopInfo[] | null;
  /** Sponsor names with a status write in flight. */
  pending: (name: string) => boolean;
  onPill: (sponsor: MySponsor, pill: StatusPill, done: boolean) => void;
  /** The portal link's copy button (shared with All sponsors). */
  copyLink: (sponsor: MySponsor) => React.ReactNode;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const current =
    sponsors.find((s) => s.name === picked) ?? sponsors[0] ?? null;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (sponsors.length === 0) {
    return (
      <p className="m-0 rounded-dashboard-lg bg-dashboard-bg-surface px-4 py-3 text-sm text-dashboard-text-medium shadow-dashboard-card">
        {copy.noneLed}
      </p>
    );
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!current) return;
    const i = sponsors.indexOf(current);
    const last = sponsors.length - 1;
    const to =
      e.key === "ArrowRight"
        ? sponsors[i === last ? 0 : i + 1]
        : e.key === "ArrowLeft"
          ? sponsors[i === 0 ? last : i - 1]
          : e.key === "Home"
            ? sponsors[0]
            : e.key === "End"
              ? sponsors[last]
              : undefined;
    if (!to) return;
    e.preventDefault();
    setPicked(to.name);
    tabRefs.current[to.name]?.focus();
  };

  const tabKey = (s: MySponsor) => s.sponsorId ?? s.name.replace(/\W+/g, "-");

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label={copy.sponsorTabsLabel}
        onKeyDown={onKeyDown}
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-dashboard-border-default px-1"
      >
        {sponsors.map((s) => {
          const selected = s === current;
          return (
            <button
              key={s.name}
              ref={(el) => {
                tabRefs.current[s.name] = el;
              }}
              type="button"
              role="tab"
              id={`my-sponsor-tab-${tabKey(s)}`}
              aria-selected={selected}
              aria-controls={`my-sponsor-panel-${tabKey(s)}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setPicked(s.name)}
              className={cn(
                "-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 rounded-t-dashboard-md border-b-2 px-3 text-sm font-semibold",
                focusRing,
                selected
                  ? "border-dashboard-action-primary text-dashboard-text-active"
                  : cn(
                      "border-transparent text-dashboard-text-light",
                      hover.nav,
                      hover.textHeavy,
                    ),
              )}
            >
              <SponsorLogo name={s.name} />
              <span className="whitespace-nowrap">{s.name}</span>
            </button>
          );
        })}
      </div>

      {current && (
        <div
          role="tabpanel"
          id={`my-sponsor-panel-${tabKey(current)}`}
          aria-labelledby={`my-sponsor-tab-${tabKey(current)}`}
          data-sponsor={current.name}
          className="flex min-w-0 flex-col overflow-hidden rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card"
        >
          <SponsorTables
            sponsor={current}
            data={current.sponsorId ? data?.[current.sponsorId] : undefined}
            loading={!data}
            summary={
              current.sponsorId
                ? summaries.get(current.sponsorId.toLowerCase())
                : undefined
            }
            workshops={workshops}
            pending={pending(current.name)}
            onPill={(pill, done) => onPill(current, pill, done)}
            copyLink={copyLink(current)}
          />
        </div>
      )}
    </div>
  );
}

function Block({
  id,
  title,
  children,
  tour,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  tour?: string;
}) {
  return (
    <table
      data-block={id}
      data-tour={tour}
      className="w-full table-fixed border-collapse text-left text-sm"
    >
      <caption className="border-t border-dashboard-border-subtle bg-dashboard-bg-inset px-4 py-2 text-left text-sm font-semibold text-dashboard-text-heavy first:border-t-0">
        {title}
      </caption>
      <tbody>{children}</tbody>
    </table>
  );
}

function Row({
  id,
  label,
  sub,
  children,
}: {
  id: string;
  label: string;
  sub?: string | null;
  children: React.ReactNode;
}) {
  return (
    <tr data-attr={id} className="border-t border-dashboard-border-subtle">
      <th
        scope="row"
        className="w-[118px] px-4 py-2.5 align-middle font-semibold text-dashboard-text-heavy sm:w-56"
      >
        {label}
        {sub && (
          <span className="block text-xs font-medium text-dashboard-text-light">
            {sub}
          </span>
        )}
      </th>
      <td className="min-w-0 break-words py-2.5 pr-4 align-middle text-dashboard-text-heavy">
        {children}
      </td>
    </tr>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-dashboard-text-light">{children}</span>;
}

/**
 * A tap-to-advance status pill: one tap moves it on, a tap when it's done
 * undoes it. Disabled while its save is in flight, or when there's no store
 * (`disabled` with a note).
 */
function Pill({
  label,
  sponsor,
  states,
  done,
  busy,
  disabled,
  onToggle,
}: {
  label: string;
  sponsor: string;
  states: readonly [string, string];
  done: boolean;
  busy?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  const [notYet, yes] = states;
  return (
    <button
      type="button"
      data-pill={label}
      data-done={done ? "true" : "false"}
      aria-pressed={done}
      aria-label={
        done
          ? copy.pill.advance(label, sponsor, yes)
          : copy.pill.next(label, sponsor, notYet, yes)
      }
      disabled={busy === true || disabled === true}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold md:min-h-9",
        focusRing,
        !disabled && press,
        done
          ? "border-dashboard-status-live bg-dashboard-schedule-green text-dashboard-text-heavy"
          : "border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-heavy",
        !disabled && !done && hover.highlight,
        (busy === true || disabled === true) &&
          "cursor-default opacity-dashboard-disabled",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          done ? "bg-dashboard-status-live" : "bg-dashboard-border-medium",
        )}
      />
      {busy ? copy.pill.saving : done ? yes : notYet}
      {done ? (
        <Check aria-hidden className="size-4" />
      ) : (
        !disabled && <ArrowRight aria-hidden className="size-4" />
      )}
    </button>
  );
}

function SponsorTables({
  sponsor,
  data,
  loading,
  summary,
  workshops,
  pending,
  onPill,
  copyLink,
}: {
  sponsor: MySponsor;
  data: MySponsorData | undefined;
  loading: boolean;
  summary: SponsorSummary | undefined;
  workshops: readonly WorkshopInfo[] | null;
  pending: boolean;
  onPill: (pill: StatusPill, done: boolean) => void;
  copyLink: React.ReactNode;
}) {
  const a = copy.attrs;
  const v = copy.value;
  const status = sponsor.fromSheet ? sponsor.status : null;
  const theirs = (workshops ?? []).filter(
    (w) => w.sponsor?.toLowerCase() === sponsor.name.toLowerCase(),
  );
  const chats = data?.chats;
  const judging = summary ? round1State(summary.sunday) : null;
  const slots = summary?.sunday.slots ?? [];

  return (
    <>
      <Block id="people" title={copy.sections.people} tour="org-people">
        {loading ? (
          <tr>
            <td colSpan={2} className="px-4 py-2.5">
              <Muted>{copy.loading}</Muted>
            </td>
          </tr>
        ) : !data || data.reps.length === 0 ? (
          <tr className="border-t border-dashboard-border-subtle">
            <td colSpan={2} className="px-4 py-2.5">
              <Muted>
                {sponsor.sponsorId ? copy.people.none : v.notRegistered}
              </Muted>
            </td>
          </tr>
        ) : (
          data.reps.map((r) => (
            <tr
              key={r.id}
              data-person={r.name}
              className="border-t border-dashboard-border-subtle"
            >
              <th
                scope="row"
                className="px-4 py-1 align-middle font-semibold text-dashboard-text-heavy"
              >
                <span className="inline-flex flex-wrap items-center gap-1 [overflow-wrap:anywhere]">
                  {r.name}
                  {r.isPrimary && (
                    <PrimaryCrownIcon label={copy.people.primary} />
                  )}
                </span>
              </th>
              <td className="py-1 pr-2 text-right align-middle">
                <PhoneCopy name={r.name} phone={r.phone} />
              </td>
            </tr>
          ))
        )}
      </Block>

      <Block id="logistics" title={copy.sections.logistics}>
        <Row id="arrival" label={a.arrival}>
          {status === null ? (
            <Muted>{dayCopy.noSheet}</Muted>
          ) : (
            <span data-tour="org-pills" className="inline-flex">
              <Pill
                label={a.arrival}
                sponsor={sponsor.name}
                states={copy.pill.arrival}
                done={pillDone("arrival", status)}
                busy={pending}
                onToggle={() => onPill("arrival", pillDone("arrival", status))}
              />
            </span>
          )}
        </Row>
        <Row id="booth" label={a.booth}>
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {sponsor.fromSheet &&
              sponsor.boothLocation &&
              sponsor.boothLocation !== "TBD"
                ? sponsor.boothLocation
                : v.boothTbd}
            </span>
            {status !== null && (
              <Pill
                label={a.booth}
                sponsor={sponsor.name}
                states={copy.pill.booth}
                done={pillDone("booth", status)}
                busy={pending}
                onToggle={() => onPill("booth", pillDone("booth", status))}
              />
            )}
          </span>
        </Row>
        <Row id="portal-link" label={a.portalLink}>
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {summary?.linkGivenAt
                ? v.linkGiven(dayTime(summary.linkGivenAt))
                : v.linkNotGiven}
            </span>
            {copyLink}
          </span>
        </Row>
        <Row id="cc-workshop" label={a.ccWorkshop} sub={copy.pill.ccNotTracked}>
          <Pill
            label={a.ccWorkshop}
            sponsor={sponsor.name}
            states={copy.pill.ccWorkshop}
            done={false}
            disabled
          />
        </Row>
        <Row id="their-workshop" label={a.theirWorkshop}>
          {workshops === null ? (
            <Muted>{v.none}</Muted>
          ) : theirs.length === 0 ? (
            <Muted>{v.noWorkshop}</Muted>
          ) : (
            theirs.map((w, i) => (
              <span key={i} className="block">
                {v.workshop(
                  [w.day?.slice(0, 3), w.start ? formatClock(w.start) : null]
                    .filter(Boolean)
                    .join(" ") || v.none,
                  w.room,
                )}
              </span>
            ))
          )}
        </Row>
      </Block>

      <Block id="chats" title={copy.sections.chats}>
        <Row id="preferences" label={a.preferences}>
          {!chats ? (
            <Muted>{v.none}</Muted>
          ) : chats.prefsSubmittedAt ? (
            v.submitted(dayTime(chats.prefsSubmittedAt))
          ) : (
            <span className="font-semibold text-dashboard-text-warning">
              {v.notSubmitted}
            </span>
          )}
        </Row>
        <Row id="shortlist" label={a.shortlist}>
          {!chats ? (
            <Muted>{v.none}</Muted>
          ) : chats.shortlistSubmittedAt ? (
            v.submitted(dayTime(chats.shortlistSubmittedAt))
          ) : (
            <Muted>{v.shortlistOptional}</Muted>
          )}
        </Row>
        <Row id="schedule" label={a.schedule}>
          {!chats ? (
            <Muted>{v.none}</Muted>
          ) : chats.repsChatting === 0 ? (
            <Muted>{v.noReps}</Muted>
          ) : (
            <span
              className={cn(
                chats.repsPlaced < chats.repsChatting &&
                  chats.prefsSubmittedAt &&
                  "font-semibold text-dashboard-text-warning",
              )}
            >
              {v.placed(chats.repsPlaced, chats.repsChatting)}
              {chats.scheduleSent && ` · ${v.confirmed}`}
            </span>
          )}
        </Row>
        <Row id="invites" label={a.invites}>
          {!chats || chats.invites === 0 ? (
            <Muted>{v.invitesNotSent}</Muted>
          ) : (
            v.invites(chats.accepted, chats.invites)
          )}
        </Row>
      </Block>

      {hasPrizeTrack(sponsor.name) && (
        <Block id="judging" title={copy.sections.judging}>
          <Row id="judging-shortlist" label={a.judgingShortlist}>
            {!judging ? (
              <Muted>{v.none}</Muted>
            ) : judging.kind === "sent" ? (
              dayCopy.round1.sent(judging.teams, dayTime(judging.at))
            ) : judging.kind === "working" ? (
              dayCopy.round1.working(judging.scored, judging.shortlisted)
            ) : (
              <Muted>{dayCopy.round1.notStarted}</Muted>
            )}
          </Row>
          <Row id="presentations" label={a.presentations}>
            {slots.length === 0 ? (
              <Muted>{v.noPresentations}</Muted>
            ) : (
              v.presentations(
                slots.length,
                (() => {
                  const first = slots[0];
                  if (!first) return null;
                  const hh = String(Math.floor(first.start / 60)).padStart(
                    2,
                    "0",
                  );
                  const mm = String(first.start % 60).padStart(2, "0");
                  return `${formatClock(`${hh}:${mm}`)}${first.room ? ` · ${first.room}` : ""}`;
                })(),
              )
            )}
          </Row>
          <Row id="top-three" label={a.topThree}>
            {summary?.sunday.finalSubmittedAt ? (
              v.topThreeSent(dayTime(summary.sunday.finalSubmittedAt))
            ) : (
              <Muted>{v.topThreeNot}</Muted>
            )}
          </Row>
        </Block>
      )}
    </>
  );
}
