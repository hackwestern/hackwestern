import { Mic } from "lucide-react";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { scheduleCopy } from "~/content/sponsor-schedule";
import {
  CEREMONIES,
  formatClock,
  type CeremonyKind,
  type CeremonySegment,
  type RunOfShowItem,
} from "~/lib/run-of-show";
import { ceremonyItem } from "~/lib/sponsor-next-event";
import { cn } from "~/lib/utils";

const copy = scheduleCopy.ceremonies;

type Segment = CeremonySegment & { yours?: boolean };

// Each ceremony's speaker running order from the "Opening + Closing
// Ceremonies" tab, as an ordered list. The sponsor's own slot is highlighted
// with a You tag. `items` gives each ceremony's time and place (RUN OF SHOW).
export function CeremonyOrder({
  segments,
  items,
  headingLevel = "h2",
}: {
  segments: Segment[];
  items: RunOfShowItem[];
  headingLevel?: "h2" | "h3";
}) {
  const groups = CEREMONIES.map((ceremony) => ({
    ceremony,
    list: segments.filter((s) => s.ceremony === ceremony),
  })).filter((g) => g.list.length > 0);
  if (groups.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {groups.map(({ ceremony, list }) => (
        <CeremonyCard
          key={ceremony}
          ceremony={ceremony}
          list={list}
          block={ceremonyItem(items, ceremony)}
          Heading={headingLevel}
        />
      ))}
    </div>
  );
}

function CeremonyCard({
  ceremony,
  list,
  block,
  Heading,
}: {
  ceremony: CeremonyKind;
  list: Segment[];
  block: RunOfShowItem | undefined;
  Heading: "h2" | "h3";
}) {
  const headingId = `ceremony-${ceremony}`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 font-figtree shadow-dashboard-card sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <Heading
          id={headingId}
          className="m-0 flex items-center gap-2 text-base font-semibold text-dashboard-text-heavy"
        >
          <Mic aria-hidden className="size-4 text-dashboard-text-light" />
          {copy.heading(ceremony)}
        </Heading>
        {block && (
          <p className="m-0 text-sm text-dashboard-text-medium">
            {copy.when(block.day, formatClock(block.start), block.location)}
          </p>
        )}
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {list.map((s) => (
          <li
            key={`${s.ceremony}-${s.order}-${s.title}`}
            className={cn(
              "grid grid-cols-[3.5rem_1fr] gap-3 rounded-dashboard-sm p-3",
              s.yours
                ? "border-l-4 border-dashboard-action-primary bg-dashboard-bg-highlight"
                : "bg-dashboard-bg-inset",
            )}
          >
            <span className="flex flex-col text-sm font-semibold text-dashboard-text-heavy">
              <span className="sr-only">{copy.srOrder(s.order)}</span>
              <span aria-hidden>#{s.order}</span>
              {s.start && (
                <span className="text-xs font-medium text-dashboard-text-medium">
                  {formatClock(s.start)}
                </span>
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="break-words font-semibold text-dashboard-text-heavy">
                  {s.title}
                </span>
                {s.yours && (
                  <DashboardTag className="bg-dashboard-action-primary px-1.5 py-0 leading-5 text-dashboard-text-inverse">
                    {scheduleCopy.you}
                  </DashboardTag>
                )}
                {s.durationMinutes !== null && (
                  <span className="text-sm text-dashboard-text-medium">
                    {copy.duration(s.durationMinutes)}
                  </span>
                )}
              </span>
              {s.sponsor && s.sponsor !== s.title && (
                <span className="text-sm text-dashboard-text-medium">
                  {s.sponsor}
                </span>
              )}
              <span className="break-words text-sm text-dashboard-text-medium">
                <span className="sr-only">{`${copy.speakersLabel}: `}</span>
                {s.speakers.length > 0 ? s.speakers.join("; ") : copy.speakersTbd}
              </span>
              {s.yours && (
                <span className="text-sm font-semibold text-dashboard-text-heavy">
                  {s.start
                    ? copy.youreOnAt(formatClock(s.start), s.durationMinutes)
                    : copy.youreSlot(s.order, list.length, s.durationMinutes)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
