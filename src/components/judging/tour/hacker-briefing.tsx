import { HackerTableCard } from "~/components/judging/board/round-board";
import { DEFAULT_RUBRIC } from "~/components/judging/shared/rubric-scorer";
import { tourHacker } from "~/components/judging/tour/tour-mocks";
import { judgingTourCopy } from "~/content/judging-tour";

const copy = judgingTourCopy.hackerBriefing;

/**
 * Judging for hackers on one screen, for the projector in the hall: timing,
 * the rules, the link and the criteria. The two page states are the real
 * hacker card on sample data.
 */
export function HackerBriefing() {
  return (
    <div className="min-h-dvh bg-dashboard-bg-page font-figtree text-dashboard-text-heavy">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-[max(16px,env(safe-area-inset-left,0px))] py-8 md:py-12">
        <header className="flex flex-col gap-3">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-dashboard-text-active md:text-sm">
            {copy.eyebrow}
          </p>
          <h1 className="m-0 text-balance text-4xl font-bold leading-[1.1] md:text-6xl">
            {copy.heading}
          </h1>
        </header>

        {/* Timing: the three parts of a round, in order, sized by length. */}
        <section aria-label={copy.timing.label} className="flex flex-col gap-3">
          <div className="flex w-full overflow-hidden rounded-2xl border border-dashboard-border-default bg-dashboard-bg-surface">
            {copy.timing.parts.map((p, i) => (
              <div
                key={p.what}
                className={`flex min-w-0 flex-col gap-1 p-4 md:p-6 ${
                  i === 0
                    ? "flex-[3] bg-dashboard-action-primary text-dashboard-text-inverse"
                    : i === 1
                      ? "flex-[2] bg-dashboard-bg-navSelected"
                      : "flex-[1.5] bg-dashboard-bg-nav"
                }`}
              >
                <span className="text-3xl font-bold tabular-nums leading-none md:text-5xl">
                  {p.time}
                </span>
                <span className="text-sm font-semibold md:text-lg">
                  {p.what}
                </span>
              </div>
            ))}
          </div>
          <p className="m-0 text-xl font-bold md:text-2xl">
            {copy.timing.note}
          </p>
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-8">
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
              {copy.rules.map((r, i) => (
                <li
                  key={r.title}
                  className={`flex flex-col gap-1.5 rounded-2xl border p-5 ${
                    i === 0
                      ? "border-dashboard-action-destructive bg-dashboard-bg-surface"
                      : "border-dashboard-border-subtle bg-dashboard-bg-surface"
                  }`}
                >
                  <span
                    className={`text-xl font-bold ${
                      i === 0 ? "text-dashboard-action-destructive" : ""
                    }`}
                  >
                    {r.title}
                  </span>
                  <span className="leading-relaxed text-dashboard-text-medium">
                    {r.body}
                  </span>
                </li>
              ))}
            </ul>

            <section className="flex flex-col gap-4 rounded-2xl border border-dashboard-border-card bg-dashboard-bg-surface p-5 md:flex-row md:items-start md:gap-6">
              <div className="flex shrink-0 flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- a fixed SVG, no resizing needed */}
                <img
                  src="/judging-tour/qr-rounds.svg"
                  alt={copy.link.alt}
                  width={180}
                  height={180}
                  className="size-[180px]"
                />
                <span className="font-bold">{copy.link.route}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <h2 className="m-0 text-xl font-bold">{copy.link.label}</h2>
                <p className="m-0 leading-relaxed text-dashboard-text-medium">
                  {copy.link.body}
                </p>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {(
                    [
                      [copy.link.states.coming, { round: 2, thisRound: "now" }],
                      [copy.link.states.idle, { round: 2, thisRound: "none" }],
                    ] as const
                  ).map(([label, state]) => (
                    <figure key={label} className="m-0 flex flex-col gap-1.5">
                      <figcaption className="text-xs font-bold uppercase tracking-[0.12em] text-dashboard-text-active">
                        {label}
                      </figcaption>
                      <HackerTableCard
                        mine={tourHacker(state)}
                        missing={null}
                      />
                    </figure>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-2xl font-bold md:text-3xl">
                {copy.criteria.label}
              </h2>
              <p className="m-0 font-semibold text-dashboard-text-light">
                {copy.criteria.note}
              </p>
            </div>
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              {DEFAULT_RUBRIC.criteria.map((c, i) => (
                <li
                  key={c.id}
                  className="grid grid-cols-[2.25rem_1fr] gap-x-3 rounded-xl border border-dashboard-border-subtle bg-dashboard-bg-surface p-4"
                >
                  <span className="row-span-2 text-3xl font-bold tabular-nums leading-none text-dashboard-action-primary">
                    {i + 1}
                  </span>
                  <span className="text-lg font-bold">{c.name}</span>
                  <span className="leading-relaxed text-dashboard-text-medium">
                    {c.description}
                  </span>
                </li>
              ))}
            </ol>
            <p className="m-0 text-sm text-dashboard-text-light">
              {copy.tourLink}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
