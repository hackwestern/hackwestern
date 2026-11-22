import { JudgeQueueList } from "~/components/judging/judge-app/judge-queue-list";
import { DEFAULT_RUBRIC } from "~/components/judging/shared/rubric-scorer";
import { TABLE_BY_TEAM, tourQueue } from "~/components/judging/tour/tour-mocks";
import { judgingTourCopy } from "~/content/judging-tour";

const copy = judgingTourCopy.judgeBriefing;

function Step({ label, heading }: { label: string; heading: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-dashboard-text-active md:text-sm">
        {label}
      </span>
      <h2 className="m-0 text-balance text-3xl font-bold leading-tight md:text-5xl">
        {heading}
      </h2>
    </div>
  );
}

/**
 * The judges' briefing on one screen, for the projector: their teams and the
 * conflict-of-interest check first, then how judging runs and what they mark.
 * The team list is the judge app's own, on sample teams.
 */
export function JudgeBriefing() {
  return (
    <div className="min-h-dvh bg-dashboard-bg-page font-figtree text-dashboard-text-heavy">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-12 px-[max(16px,env(safe-area-inset-left,0px))] py-8 md:py-12">
        <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-dashboard-text-light md:text-sm">
          {copy.eyebrow}
        </p>

        {/* 1. Your teams, and the conflict check before anything else. */}
        <section className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="flex min-w-0 flex-col gap-6">
            <Step label={copy.teams.step} heading={copy.teams.heading} />
            <p className="m-0 max-w-[60ch] text-lg leading-relaxed text-dashboard-text-medium">
              {copy.teams.body}
            </p>
            <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashboard-action-primary bg-dashboard-bg-surface p-6">
              <h3 className="m-0 text-2xl font-bold md:text-3xl">
                {copy.conflict.heading}
              </h3>
              <p className="m-0 text-lg leading-relaxed text-dashboard-text-medium">
                {copy.conflict.body}
              </p>
              <p className="m-0 rounded-xl bg-dashboard-bg-highlight px-4 py-3 text-xl font-bold text-dashboard-text-active md:text-2xl">
                {copy.conflict.action}
              </p>
              <p className="m-0 text-dashboard-text-light">
                {copy.conflict.after}
              </p>
            </div>
          </div>

          <figure className="m-0 flex flex-col gap-2">
            <figcaption className="text-sm font-semibold uppercase tracking-wider text-dashboard-text-light">
              {copy.teams.phone}
            </figcaption>
            <div className="mx-auto flex max-h-[640px] w-full max-w-[400px] flex-col overflow-hidden rounded-[34px] border-[6px] border-dashboard-text-heavy bg-dashboard-bg-page shadow-[0_18px_40px_-24px_rgba(11,43,74,0.45)]">
              <div className="flex shrink-0 justify-center border-b border-dashboard-border-subtle bg-dashboard-bg-nav py-2 text-xs font-medium text-dashboard-text-light">
                <span className="rounded-full bg-dashboard-bg-surface px-3 py-0.5">
                  {copy.teams.url}
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <JudgeQueueList queue={tourQueue} tableByTeam={TABLE_BY_TEAM} />
              </div>
            </div>
          </figure>
        </section>

        {/* 2. How it runs. */}
        <section className="flex flex-col gap-6 border-t border-dashboard-border-subtle pt-10">
          <Step label={copy.run.step} heading={copy.run.heading} />
          <div className="flex w-full overflow-hidden rounded-2xl border border-dashboard-border-default bg-dashboard-bg-surface">
            {copy.run.parts.map((p, i) => (
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
          <p className="m-0 text-xl font-bold md:text-2xl">{copy.run.note}</p>

          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
            <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
              {copy.run.steps.map((s, i) => (
                <li
                  key={s.title}
                  className="flex flex-col gap-1.5 rounded-2xl border border-dashboard-border-subtle bg-dashboard-bg-surface p-5"
                >
                  <span className="text-sm font-bold tabular-nums text-dashboard-action-primary">
                    {i + 1}
                  </span>
                  <span className="text-xl font-bold">{s.title}</span>
                  <span className="leading-relaxed text-dashboard-text-medium">
                    {s.body}
                  </span>
                </li>
              ))}
            </ol>

            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="m-0 text-2xl font-bold md:text-3xl">
                  {copy.criteria.label}
                </h3>
                <p className="m-0 font-semibold text-dashboard-text-light">
                  {copy.criteria.note}
                </p>
              </div>
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {DEFAULT_RUBRIC.criteria.map((c, i) => (
                  <li
                    key={c.id}
                    className="grid grid-cols-[2rem_1fr] gap-x-3 rounded-xl border border-dashboard-border-subtle bg-dashboard-bg-surface p-3.5"
                  >
                    <span className="row-span-2 text-2xl font-bold tabular-nums leading-none text-dashboard-action-primary">
                      {i + 1}
                    </span>
                    <span className="font-bold">{c.name}</span>
                    <span className="text-sm leading-relaxed text-dashboard-text-medium">
                      {c.description}
                    </span>
                  </li>
                ))}
              </ol>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {[
                  copy.criteria.superLike,
                  copy.criteria.completeness,
                  copy.criteria.mlh,
                ].map((line) => (
                  <li
                    key={line}
                    className="rounded-xl bg-dashboard-bg-highlight px-4 py-3 leading-relaxed text-dashboard-text-medium"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="m-0 text-sm text-dashboard-text-light">
            {copy.tourLink}
          </p>
        </section>
      </div>
    </div>
  );
}
