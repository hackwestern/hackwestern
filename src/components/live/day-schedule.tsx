import { useState, useEffect } from "react";
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
    | "scavenger"
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
    scavenger: "bg-orange-100 border-orange-200",
    other: "bg-purple-300 border-purple-400",
  };

  const textColorMap = {
    main: "text-violet-900",
    sponsor: "text-pink-900",
    workshop: "text-yellow-900",
    activity: "text-green-900",
    food: "text-blue-900",
    booth: "text-pink-900",
    scavenger: "text-orange-900",
    other: "text-purple-900",
  };

  return (
    <div
      className={`rounded-lg border-2 p-1.5 sm:p-2.5 ${colorMap[type]} ${textColorMap[type]} absolute left-0 right-0 top-0 z-50 flex select-text flex-col justify-center shadow-sm transition-shadow hover:shadow-md`}
      style={{ height: `${height}px` }}
    >
      <div className="select-text font-figtree text-[9px] font-semibold leading-tight sm:text-[11px]">
        {event.title}
      </div>
      {event.location && (
        <div className="mt-0.5 select-text font-figtree text-[8px] italic opacity-70 sm:text-[9px]">
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
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop screen size (sm breakpoint is 640px)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 640px)');
    setIsDesktop(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Get current EST time
  const getCurrentESTTime = (): Date => {
    const now = new Date();
    // EST is UTC-5, EDT is UTC-4. Using EST (UTC-5) as specified
    const estOffset = -5 * 60; // EST offset in minutes
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const estTime = new Date(utc + estOffset * 60000);
    return estTime;
  };

  // Check if this is the current day
  const isCurrentDay = (): boolean => {
    if (!currentTime) return false;
    const currentDate = currentTime.getDate();
    const currentMonth = currentTime.getMonth(); // 0-indexed, November is 10

    // November 21 = Friday, November 22 = Saturday, November 23 = Sunday
    if (day === "Friday" && currentDate === 21 && currentMonth === 10) {
      return true;
    }
    if (day === "Saturday" && currentDate === 22 && currentMonth === 10) {
      return true;
    }
    if (day === "Sunday" && currentDate === 23 && currentMonth === 10) {
      return true;
    }
    return false;
  };

  // Update current time every minute at the beginning of the minute
  useEffect(() => {
    // Set initial time
    setCurrentTime(getCurrentESTTime());

    const updateTime = () => {
      setCurrentTime(getCurrentESTTime());
    };

    // Calculate milliseconds until the next minute boundary (when seconds = 0)
    const now = getCurrentESTTime();
    const secondsUntilNextMinute = 60 - now.getSeconds();
    const msUntilNextMinute = secondsUntilNextMinute * 1000;

    let intervalId: NodeJS.Timeout | null = null;

    // Set timeout for first update at the next minute boundary
    const timeoutId = setTimeout(() => {
      updateTime();
      // Then set interval to update every minute (60000 ms) at :00 seconds
      intervalId = setInterval(updateTime, 60000); // 1 minute = 60000 ms
    }, msUntilNextMinute);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  // Calculate current time position
  const getCurrentTimePosition = (): number | null => {
    if (!currentTime || !isCurrentDay() || timeSlots.length === 0) {
      return null;
    }

    const currentMinutes =
      currentTime.getHours() * 60 + currentTime.getMinutes();
    const baseSlotHeight = 56;
    const gapHeight = isDesktop ? 8 : 6; // space-y-1.5 (6px) mobile, space-y-2 (8px) desktop
    const rowTopOffset = 5; // border-top (1px) + pt-1 (4px) = 5px

    // Find the position by iterating through time slots
    let cumulativeHeight = rowTopOffset; // Start with first row's top offset

    for (let i = 0; i < timeSlots.length; i++) {
      const event = timeSlots[i];
      if (!event) continue;

      const slotMinutes = getTimeInMinutes(event.time);
      const nextEvent = timeSlots[i + 1];
      const nextMinutes = nextEvent
        ? getTimeInMinutes(nextEvent.time)
        : slotMinutes + 30;
      const duration = nextMinutes - slotMinutes;

      // Check if current time is within this slot
      if (currentMinutes >= slotMinutes && currentMinutes < nextMinutes) {
        const timeWithinSlot = currentMinutes - slotMinutes;
        const isLargeGap = duration > 120;
        const slotHeight = isLargeGap
          ? 20
          : Math.max(baseSlotHeight, (duration / 30) * baseSlotHeight);
        const positionInSlot = (timeWithinSlot / duration) * slotHeight;
        return cumulativeHeight + positionInSlot;
      }

      // Add this slot's height to cumulative
      const isLargeGap = duration > 120;
      const slotHeight = isLargeGap
        ? 20
        : Math.max(baseSlotHeight, (duration / 30) * baseSlotHeight);

      cumulativeHeight += slotHeight;

      // Add the gap indicator row height if there's a large gap
      if (isLargeGap) {
        cumulativeHeight += 40 + gapHeight; // 40px gap indicator + 6px gap
      }

      // Add gap for next row (space-y-1.5 doesn't apply to first row)
      if (i < timeSlots.length - 1) {
        cumulativeHeight += gapHeight;
      }
    }

    // If time is before first slot, return 0
    const firstSlotMinutes = getTimeInMinutes(timeSlots[0]!.time);
    if (currentMinutes < firstSlotMinutes) {
      return rowTopOffset;
    }

    // If time is after last slot, return null (don't show line)
    return null;
  };

  const currentTimePosition = getCurrentTimePosition();
  const showCurrentTimeLine = isCurrentDay() && currentTimePosition !== null;

  // Format current time for display
  const formatCurrentTime = (): string => {
    if (!currentTime) return "";
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    return `${displayHours}:${displayMinutes} ${period}`;
  };

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
    if (!startEvent) return 56;

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
      const baseSlotHeight = 56; // must match baseSlotHeight in row rendering
      const slotHeight = Math.max(
        baseSlotHeight,
        (duration / 30) * baseSlotHeight,
      );

      totalHeight += slotHeight + 6; // 6px gap between rows (approx space-y-1.5)
    }

    return totalHeight - 6; // Remove last gap
  };

  return (
    <div className="w-full pb-3 sm:pb-4">
      <div className="rounded-sm px-3 py-4 sm:p-6">
        {/* Header with day name */}
        <div className="sticky left-0 mb-3 mt-1 font-figtree text-lg font-bold text-heavy sm:mb-4 sm:mt-2 sm:text-2xl">
          {day}, November{" "}
          {day === "Friday" ? "21st" : day === "Saturday" ? "22nd" : "23rd"}
        </div>

        {/* Timeline rows */}
        <div className="relative space-y-1.5 sm:space-y-2">
          {/* Current time indicator line */}
          {showCurrentTimeLine && (
            <div
              className="absolute left-0 right-0 z-[70] flex items-center"
              style={{
                top: `${currentTimePosition}px`,
                transform: "translateY(-50%)",
              }}
            >
              <div className="flex w-[80px] items-center justify-end pr-2">
                <span className="bg-red-500 px-1.5 py-0.5 font-jetbrains-mono text-[8px] font-bold text-white sm:text-[10px]">
                  {formatCurrentTime()}
                </span>
              </div>
              <div className="h-0.5 flex-1 bg-red-500"></div>
            </div>
          )}
          {timeSlots.map((event, idx) => {
            const nextEvent = timeSlots[idx + 1];
            const currentMinutes = getTimeInMinutes(event.time);
            const nextMinutes = nextEvent
              ? getTimeInMinutes(nextEvent.time)
              : currentMinutes + 30;
            const duration = nextMinutes - currentMinutes;

            // If there's a large gap (> 2 hours), use minimal height and insert a gap indicator row
            const isLargeGap = duration > 120;
            const baseSlotHeight = 56; // smaller base height for mobile
            const height = isLargeGap
              ? 20
              : Math.max(baseSlotHeight, (duration / 30) * baseSlotHeight);

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
                | "scavenger"
                | "other";
            }> = [
              { key: "bigEvent", type: "main" },
              { key: "sponsorWorkshop", type: "sponsor" },
              { key: "otherWorkshop", type: "workshop" },
              { key: "activities1", type: "activity" },
              { key: "activities2", type: "activity" },
              { key: "food", type: "food" },
              { key: "sponsorBooth", type: "booth" },
              { key: "scavengerHunt", type: "scavenger" },
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
                | "scavenger"
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
                  className="grid gap-1.5 border-t border-gray-200 pt-1 sm:gap-2"
                  style={{
                    minHeight: `${height}px`,
                    gridTemplateColumns: `60px repeat(9, 1fr)`,
                  }}
                >
                  {/* Time label */}
                  <div className="font-base flex items-start pt-1.5 font-figtree text-[10px] text-medium sm:pt-2 sm:text-xs">
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
                    className="grid grid-cols-[60px_repeat(9,1fr)] gap-1.5 rounded-md border border-dashed border-gray-300 bg-gray-50 sm:gap-2"
                    style={{ minHeight: "40px" }}
                  >
                    <div className="flex items-center justify-center text-xs font-medium text-gray-400">
                      ⋯
                    </div>
                    {Array(9)
                      .fill(null)
                      .map((_, colIdx) => (
                        <div
                          key={colIdx}
                          className="flex items-center justify-center text-gray-300"
                        >
                          <span className="text-xl">⋯</span>
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
