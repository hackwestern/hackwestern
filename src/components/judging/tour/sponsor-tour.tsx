import { useCallback, useEffect, useState, type ReactNode } from "react";

import { PresentationScoring } from "~/components/sponsors/judging/presentation-scoring";
import { ProjectCard } from "~/components/sponsors/judging/project-card";
import {
  Device,
  List,
  type Screen,
} from "~/components/judging/tour/judging-tour";
import {
  SPONSOR_TOUR_ME,
  sponsorTourData,
  sponsorTourFirst,
  sponsorTourReviews,
  sponsorTourScores,
} from "~/components/judging/tour/sponsor-tour-mocks";
import { judgingTourCopy } from "~/content/judging-tour";
import { SPONSOR_FINAL_TOP } from "~/lib/sponsor-scoring";

const copy = judgingTourCopy.sponsorTour;
type StopId = keyof typeof copy.stops;
const STOP_IDS = Object.keys(copy.stops) as StopId[];
const noop = () => undefined;

/** The portal page around a sample component. */
function Portal({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col gap-4 bg-dashboard-bg-page p-5 font-figtree">
      {children}
    </div>
  );
}

/** The ranked list a sponsor submits, filled with sample teams. */
function SampleRanking() {
  const ranked = sponsorTourData.teams
    .map((t) => ({ t, avg: sponsorTourScores.get(t.id)?.average ?? 0 }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, SPONSOR_FINAL_TOP);
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-dashboard-border-subtle bg-dashboard-bg-surface p-5">
      <h3 className="m-0 text-xl font-bold text-dashboard-text-heavy">
        {copy.stops.rank.heading}
      </h3>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {ranked.map(({ t }, i) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-xl border border-dashboard-border-default bg-dashboard-bg-surface px-4 py-3"
          >
            <span className="w-6 text-lg font-bold tabular-nums text-dashboard-action-primary">
              {copy.stops.rank.place(i + 1)}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-dashboard-text-heavy">
              {t.name}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function screensFor(id: StopId): Screen[] | null {
  switch (id) {
    case "score":
    case "open":
      return [
        {
          label: copy.stops.score.nav,
          node: (
            <Portal>
              <ProjectCard
                team={sponsorTourFirst}
                review={undefined}
                saveState={undefined}
                onSave={noop}
                me={SPONSOR_TOUR_ME}
                myScore={null}
                scores={undefined}
                owner={null}
                onScore={noop}
              />
            </Portal>
          ),
        },
      ];
    case "shortlist":
      return [
        {
          label: copy.stops.shortlist.nav,
          node: (
            <Portal>
              <ProjectCard
                team={sponsorTourFirst}
                review={sponsorTourReviews.get(sponsorTourFirst.id)}
                saveState="saved"
                onSave={noop}
                me={SPONSOR_TOUR_ME}
                myScore={8.5}
                scores={sponsorTourScores.get(sponsorTourFirst.id)}
                owner={null}
                onScore={noop}
              />
            </Portal>
          ),
        },
      ];
    case "present":
    case "room":
      return [
        {
          label: copy.stops.present.nav,
          node: (
            <Portal>
              <PresentationScoring
                me={SPONSOR_TOUR_ME}
                data={sponsorTourData}
                scoresByTeam={sponsorTourScores}
                saveState={{}}
                onScore={noop}
              />
            </Portal>
          ),
        },
      ];
    case "rank":
      return [
        {
          label: copy.stops.rank.nav,
          node: (
            <Portal>
              <SampleRanking />
            </Portal>
          ),
        },
      ];
    default:
      return null;
  }
}

/**
 * The sponsor judging walkthrough: the morning at a glance, then each step
 * with the real sponsor portal components on sample teams.
 */
export function SponsorTour() {
  const [at, setAt] = useState(0);
  const id = STOP_IDS[at] ?? "day";

  useEffect(() => {
    const read = () => {
      const i = STOP_IDS.indexOf(window.location.hash.slice(1) as StopId);
      if (i >= 0) setAt(i);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = useCallback((i: number) => {
    const next = Math.max(0, Math.min(STOP_IDS.length - 1, i));
    setAt(next);
    history.replaceState(null, "", `#${STOP_IDS[next]}`);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [role=slider]") ?? t?.isContentEditable)
        return;
      if (e.key === "ArrowRight") go(at + 1);
      if (e.key === "ArrowLeft") go(at - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, go]);

  const stops = copy.stops;
  const title =
    id === "rank" ? stops.rank.title(SPONSOR_FINAL_TOP) : stops[id].title;
  const items: readonly string[] =
    id === "day"
      ? []
      : id === "rank"
        ? stops.rank.items(SPONSOR_FINAL_TOP)
        : stops[id].items;
  const screens = screensFor(id);
  const last = at === STOP_IDS.length - 1;
  const navLabel = (s: StopId) => stops[s].nav;

  return (
    <div className="min-h-dvh bg-dashboard-bg-page font-figtree text-dashboard-text-heavy">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-[max(16px,env(safe-area-inset-left,0px))] py-8 md:gap-10 md:py-12">
        <header className="flex flex-col gap-5">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-dashboard-text-active">
            {copy.eyebrow}
          </p>
          <h1 className="m-0 text-balance text-4xl font-bold leading-[1.1] md:text-5xl">
            {copy.heading}
          </h1>
          <p className="m-0 max-w-[62ch] text-lg leading-relaxed text-dashboard-text-medium">
            {copy.intro}
          </p>
          <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-dashboard-border-subtle py-4 md:grid-cols-4">
            {copy.facts.map((f) => (
              <div key={f.label} className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-dashboard-text-light">
                  {f.label}
                </dt>
                <dd className="m-0 font-semibold">{f.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav
            aria-label={judgingTourCopy.stopsLabel}
            className="min-w-0 lg:sticky lg:top-6 lg:self-start"
          >
            <ol className="m-0 flex list-none gap-1.5 overflow-x-auto p-0 pb-1 lg:flex-col lg:overflow-visible">
              {STOP_IDS.map((sid, i) => (
                <li key={sid} className="shrink-0">
                  <button
                    type="button"
                    aria-current={i === at ? "step" : undefined}
                    onClick={() => go(i)}
                    className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-dashboard-action-primary ${
                      i === at
                        ? "bg-dashboard-action-primary text-dashboard-text-inverse"
                        : "text-dashboard-text-medium hover:bg-dashboard-bg-nav"
                    }`}
                  >
                    <span className="w-5 text-right tabular-nums opacity-70">
                      {i + 1}
                    </span>
                    <span className="whitespace-nowrap">{navLabel(sid)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <article className="flex min-w-0 flex-col gap-6">
            <p className="m-0 text-sm font-semibold tabular-nums text-dashboard-text-light">
              {judgingTourCopy.stopOf(at + 1, STOP_IDS.length)}
            </p>
            <h2 className="m-0 text-balance text-3xl font-bold leading-tight md:text-4xl">
              {title}
            </h2>

            {id === "day" ? (
              <div className="flex flex-col gap-5">
                <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-3">
                  {stops.day.steps.map((s, i) => (
                    <li
                      key={s.title}
                      className={`flex flex-col gap-2 rounded-2xl border p-5 ${
                        i === 0
                          ? "border-dashboard-action-primary bg-dashboard-bg-surface"
                          : "border-dashboard-border-subtle bg-dashboard-bg-surface"
                      }`}
                    >
                      <span className="text-sm font-bold tabular-nums text-dashboard-text-active">
                        {s.time}
                      </span>
                      <span className="text-2xl font-bold">{s.title}</span>
                      <span className="leading-relaxed text-dashboard-text-medium">
                        {s.body}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="m-0 max-w-[70ch] rounded-2xl border border-dashboard-border-outline bg-dashboard-bg-highlight p-5 text-lg leading-relaxed text-dashboard-text-medium">
                  {stops.day.rep}
                </p>
              </div>
            ) : (
              <div
                className={`grid grid-cols-1 items-start gap-8 ${
                  screens
                    ? "xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
                    : "max-w-[760px]"
                }`}
              >
                <List items={items} />
                {screens && (
                  <Device
                    key={id}
                    kind="browser"
                    title={copy.screen}
                    url={copy.url}
                    screens={screens}
                  />
                )}
              </div>
            )}

            {screens && (
              <p className="m-0 text-sm text-dashboard-text-light">
                {copy.sample}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-dashboard-border-subtle pt-5">
              <button
                type="button"
                onClick={() => go(at - 1)}
                disabled={at === 0}
                className="min-h-11 rounded-xl border border-dashboard-border-default bg-dashboard-bg-surface px-5 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-action-primary disabled:opacity-40"
              >
                {judgingTourCopy.back}
              </button>
              <button
                type="button"
                onClick={() => go(last ? 0 : at + 1)}
                className="min-h-11 rounded-xl bg-dashboard-action-primary px-6 font-semibold text-dashboard-text-inverse focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-action-primary"
              >
                {last
                  ? judgingTourCopy.restart
                  : `${judgingTourCopy.next}: ${navLabel(STOP_IDS[at + 1] ?? "day")}`}
              </button>
              <span className="ml-auto hidden text-sm text-dashboard-text-light md:inline">
                {judgingTourCopy.keys}
              </span>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
