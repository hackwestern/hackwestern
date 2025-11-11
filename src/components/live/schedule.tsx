import Image from "next/image";
import { useState } from "react";
import Construction from "~/components/live/construction";

const Schedule = () => {
  return <Construction />;
  /*
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  return (
    <div className="mb-8 flex h-fit w-fit flex-col gap-3 p-5 sm:p-10">
      <div>
        {["Friday", "Saturday", "Sunday"].map((day) => (
          <span
            key={day}
            className={`cursor-pointer rounded-md px-1.5 py-1 ${
              selectedDays.includes(day)
                ? "bg-primary-600 text-primary-100"
                : "bg-primary-200 text-violet-500"
            } mx-1.5 transition-all hover:bg-primary-500 hover:text-primary-100`}
            onClick={() => {
              setSelectedDays((prev) =>
                prev.includes(day)
                  ? prev.filter((prevDay) => prevDay !== day)
                  : [...prev, day],
              );
            }}
          >
            {day}
          </span>
        ))}
      </div>
      <div
        className={`h-fit w-fit min-w-[200%] space-y-2 rounded-md bg-primary-300 p-4 md:min-w-fit ${!selectedDays.includes("Friday") && selectedDays.length >= 1 && "hidden"}`}
      >
        <span>Friday</span>
        <Image
          src="/images/schedule/1.png"
          alt="schedule 1"
          width={1000}
          height={1000}
          className="h-fit w-fit"
        />
      </div>
      <div
        className={`h-fit w-fit min-w-[200%] space-y-2 rounded-md bg-primary-300 p-4 md:min-w-fit ${!selectedDays.includes("Saturday") && selectedDays.length >= 1 && "hidden"}`}
      >
        <span>Saturday</span>
        <Image
          src="/images/schedule/2.png"
          alt="schedule 2"
          width={1000}
          height={1000}
          className="h-fit w-fit"
        />
      </div>
      <div
        className={`h-fit w-fit min-w-[200%] space-y-2 rounded-md bg-primary-300 p-4 md:min-w-fit ${!selectedDays.includes("Sunday") && selectedDays.length >= 1 && "hidden"}`}
      >
        <span>Sunday</span>
        <Image
          src="/images/schedule/3.png"
          alt="schedule 3"
          width={1000}
          height={1000}
          className="h-fit w-fit"
        />
      </div>
      <div className="my-3 border-white" />
    </div>
  );
  */
};

export default Schedule;
