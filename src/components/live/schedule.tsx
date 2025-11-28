import { useState, useEffect } from "react";
import DayScheduleView from "~/components/live/day-schedule";
import { fetchScheduleData } from "~/lib/schedule";
import type { DaySchedule } from "~/types/schedule";

const Schedule = () => {
  const [scheduleData, setScheduleData] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSchedule = async () => {
      setLoading(true);
      const data = await fetchScheduleData();
      setScheduleData(data);
      setLoading(false);
    };
    void loadSchedule();
  }, []);

  if (loading) {
    return (
      <div className="mb-4 flex h-fit w-full flex-col gap-2 px-3 py-4 sm:mb-8 sm:p-10">
        <div className="text-center font-jetbrains-mono text-sm text-medium sm:text-lg">
          LOADING SCHEDULE...
        </div>
      </div>
    );
  }

  const categoryLabels = [
    "MAIN EVENT",
    "SPONSOR\nWORKSHOPS",
    "OTHER\nWORKSHOPS",
    "ACTIVITIES",
    "ACTIVITIES",
    "FOOD",
    "SPONSOR\nBOOTH",
    "SCAVENGER\nHUNT",
    "OTHER",
  ];

  return (
    <div className="mb-4 flex h-fit w-full flex-col px-3 py-4 sm:mb-8 sm:p-10">
      {/* Single scrollable container for both headers and schedule */}
      <div className="max-h-[calc(100vh-160px)] w-full overflow-x-auto overflow-y-auto pb-10 sm:pb-20">
        <div className="min-w-[900px] sm:min-w-[1000px]">
          {/* Sticky category headers */}
          <div className="sticky top-0 z-[60] mb-4 border-b border-gray-200 py-2 backdrop-blur-sm sm:mb-6 sm:border-b-2 sm:py-3">
            <div className="grid grid-cols-[60px_repeat(9,1fr)] items-center gap-1 sm:grid-cols-[70px_repeat(9,1fr)] sm:gap-2">
              <div className="font-jetbrains-mono text-[10px] font-semibold text-gray-500 sm:text-xs"></div>
              {categoryLabels.map((label, i) => (
                <div
                  key={i}
                  className="whitespace-pre-line text-center text-[10px] font-semibold leading-tight text-gray-700 sm:text-xs"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Schedule views */}
          <div className="space-y-4 sm:space-y-8">
            {scheduleData.map((daySchedule) => (
              <div
                key={daySchedule.day}
                className="duration-300 animate-in fade-in"
              >
                <DayScheduleView
                  day={daySchedule.day}
                  events={daySchedule.events}
                  showHeaders={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {scheduleData.length === 0 && (
        <div className="py-10 text-center font-figtree text-medium">
          No schedule data available
        </div>
      )}
    </div>
  );
};

export default Schedule;
