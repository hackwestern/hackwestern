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
      <div className="mb-8 flex h-fit w-full flex-col gap-3 p-5 sm:p-10">
        <div className="text-center text-lg text-gray-600">
          Loading schedule...
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
    "OTHER",
  ];

  return (
    <div className="mb-8 flex h-fit w-full flex-col p-5 sm:p-10">
      {/* Single scrollable container for both headers and schedule */}
      <div className="max-h-[calc(100vh-200px)] w-full overflow-x-auto overflow-y-auto pb-20">
        <div className="min-w-[1000px]">
          {/* Sticky category headers */}
          <div className="sticky top-0 z-[60] mb-6 border-b-2 border-gray-200 bg-white/95 py-3 backdrop-blur-sm">
            <div className="grid grid-cols-[80px_repeat(8,1fr)] gap-2">
              <div className="text-xs font-semibold text-gray-500"></div>
              {categoryLabels.map((label, i) => (
                <div
                  key={i}
                  className="whitespace-pre-line text-center text-xs font-semibold leading-tight text-gray-700"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Schedule views */}
          <div className="space-y-8">
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
        <div className="py-10 text-center text-gray-600">
          No schedule data available
        </div>
      )}
    </div>
  );
};

export default Schedule;
