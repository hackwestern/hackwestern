import type { ParsedScheduleEvent } from "~/types/schedule";
import { getTimeInMinutes } from "~/lib/schedule";

interface EventBlockProps {
  event: {
    title: string;
    location: string;
  };
  type:
    | "main"
    | "sponsor"
    | "workshop"
    | "activity"
    | "food"
    | "booth"
    | "other";
  height: number;
}

const EventBlock = ({ event, type, height }: EventBlockProps) => {
  const colorMap = {
    main: "bg-violet-300 border-violet-400",
    sponsor: "bg-pink-200 border-pink-300",
    workshop: "bg-yellow-200 border-yellow-300",
    activity: "bg-green-200 border-green-300",
    food: "bg-blue-200 border-blue-300",
    booth: "bg-pink-100 border-pink-200",
    other: "bg-purple-300 border-purple-400",
  };

  const textColorMap = {
    main: "text-violet-900",
    sponsor: "text-pink-900",
    workshop: "text-yellow-900",
    activity: "text-green-900",
    food: "text-blue-900",
    booth: "text-pink-900",
    other: "text-purple-900",
  };

  return (
    <div
      className={`rounded-lg border-2 p-2 sm:p-3 ${colorMap[type]} ${textColorMap[type]} absolute left-0 right-0 top-0 z-50 flex select-text flex-col justify-center shadow-sm transition-shadow hover:shadow-md`}
      style={{ height: `${height}px` }}
    >
      <div className="select-text font-figtree text-[11px] font-semibold leading-tight sm:text-xs">
        {event.title}
      </div>
      {event.location && (
        <div className="mt-0.5 select-text font-figtree text-[9px] italic opacity-70 sm:text-[10px]">
          {event.location}
        </div>
      )}
    </div>
  );
};

interface DayScheduleProps {
  day: string;
  events: ParsedScheduleEvent[];
  showHeaders?: boolean;
}

const DayScheduleView = ({ day, events }: DayScheduleProps) => {
  const timeSlots = events.filter((e) => e.time);

  // Helper function to check if an event should continue (skip rendering)
  const shouldSkipEvent = (
    currentEvent: { title: string; location: string } | undefined,
    idx: number,
    eventKey: keyof ParsedScheduleEvent,
  ): boolean => {
    if (!currentEvent || idx === 0) return false;
    const prevEvent = timeSlots[idx - 1]?.[eventKey] as
      | { title: string; location: string }
      | undefined;
    return prevEvent?.title === currentEvent.title;
  };

  // Helper function to calculate the height of a continuous event block
  const getEventHeight = (
    startIdx: number,
    eventKey: keyof ParsedScheduleEvent,
  ): number => {
    const startEvent = timeSlots[startIdx]?.[eventKey] as
      | { title: string; location: string }
      | undefined;
    if (!startEvent) return 80;

    let totalHeight = 0;
    for (let i = startIdx; i < timeSlots.length; i++) {
      const currentEvent = timeSlots[i]?.[eventKey] as
        | { title: string; location: string }
        | undefined;

      // If event changes, stop calculating
      if (currentEvent?.title !== startEvent.title) break;

      const nextEvent = timeSlots[i + 1];
      const currentMinutes = getTimeInMinutes(timeSlots[i]!.time);
      const nextMinutes = nextEvent
        ? getTimeInMinutes(nextEvent.time)
        : currentMinutes + 30;
      const duration = nextMinutes - currentMinutes;
      const slotHeight = Math.max(80, (duration / 30) * 80);

      totalHeight += slotHeight + 8; // 8px gap between rows
    }

    return totalHeight - 8; // Remove last gap
  };

  return (
    <div className="w-full pb-4">
      <div className="rounded-sm p-6">
        {/* Header with day name */}
        <div className="sticky left-0 mb-4 mt-2 font-figtree text-2xl font-bold text-heavy">
          {day}, November{" "}
          {day === "Friday" ? "21st" : day === "Saturday" ? "22nd" : "23rd"}
        </div>

        {/* Timeline rows */}
        <div className="space-y-2 ">
          {timeSlots.map((event, idx) => {
            const nextEvent = timeSlots[idx + 1];
            const currentMinutes = getTimeInMinutes(event.time);
            const nextMinutes = nextEvent
              ? getTimeInMinutes(nextEvent.time)
              : currentMinutes + 30;
            const duration = nextMinutes - currentMinutes;

            // If there's a large gap (> 2 hours), use minimal height and insert a gap indicator row
            const isLargeGap = duration > 120;
            const height = isLargeGap ? 60 : Math.max(80, (duration / 30) * 80);

            // Define event columns in order
            const eventColumns: Array<{
              key: keyof ParsedScheduleEvent;
              type:
                | "main"
                | "sponsor"
                | "workshop"
                | "activity"
                | "food"
                | "booth"
                | "other";
            }> = [
              { key: "bigEvent", type: "main" },
              { key: "sponsorWorkshop", type: "sponsor" },
              { key: "otherWorkshop", type: "workshop" },
              { key: "activities1", type: "activity" },
              { key: "activities2", type: "activity" },
              { key: "food", type: "food" },
              { key: "sponsorBooth", type: "booth" },
              { key: "other", type: "other" },
            ];

            // Group consecutive columns with the same event
            const mergedColumns: Array<{
              event: { title: string; location: string } | undefined;
              type:
                | "main"
                | "sponsor"
                | "workshop"
                | "activity"
                | "food"
                | "booth"
                | "other";
              span: number;
              startKey: keyof ParsedScheduleEvent;
            }> = [];

            let i = 0;
            while (i < eventColumns.length) {
              const col = eventColumns[i]!;
              const currentEvent = event[col.key] as
                | { title: string; location: string }
                | undefined;

              let span = 1;
              // Check how many consecutive columns have the same event
              while (i + span < eventColumns.length) {
                const nextCol = eventColumns[i + span]!;
                const nextEvent = event[nextCol.key] as
                  | { title: string; location: string }
                  | undefined;
                if (
                  currentEvent &&
                  nextEvent &&
                  currentEvent.title === nextEvent.title
                ) {
                  span++;
                } else {
                  break;
                }
              }

              mergedColumns.push({
                event: currentEvent,
                type: col.type,
                span,
                startKey: col.key,
              });

              i += span;
            }

            return (
              <>
                <div
                  key={idx}
                  className="grid gap-2 border-t border-gray-200 pt-1"
                  style={{
                    minHeight: `${height}px`,
                    gridTemplateColumns: `80px repeat(8, 1fr)`,
                  }}
                >
                  {/* Time label */}
                  <div className="font-base flex items-start pt-2 font-figtree text-xs text-medium sm:text-sm">
                    {event.time}
                  </div>

                  {/* Render merged columns */}
                  {mergedColumns.map((col, colIdx) => (
                    <div
                      key={colIdx}
                      className="relative"
                      style={{ gridColumn: `span ${col.span}` }}
                    >
                      {col.event &&
                        !shouldSkipEvent(col.event, idx, col.startKey) && (
                          <EventBlock
                            event={col.event}
                            type={col.type}
                            height={getEventHeight(idx, col.startKey)}
                          />
                        )}
                    </div>
                  ))}
                </div>

                {/* Gap indicator row */}
                {isLargeGap && (
                  <div
                    key={`gap-${idx}`}
                    className="grid grid-cols-[80px_repeat(8,1fr)] gap-2 rounded-md border border-dashed border-gray-300 bg-gray-100"
                    style={{ minHeight: "60px" }}
                  >
                    <div className="flex items-center justify-center text-xs font-medium text-gray-400">
                      ⋯
                    </div>
                    {Array(8)
                      .fill(null)
                      .map((_, colIdx) => (
                        <div
                          key={colIdx}
                          className="flex items-center justify-center text-gray-300"
                        >
                          <span className="text-2xl">⋯</span>
                        </div>
                      ))}
                  </div>
                )}
              </>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DayScheduleView;
