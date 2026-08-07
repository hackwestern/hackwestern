import { useEffect, useState } from "react";

// Swap for the real deadline (e.g. from env.PROJECT_SUBMISSION_DEADLINE)
// once this is wired to the backend.
const MOCK_SUBMISSION_DEADLINE = new Date("2026-08-09T18:00:00");

function getTimeLeft(deadline: Date) {
  const diffMs = deadline.getTime() - Date.now();
  if (diffMs <= 0) return null;

  const totalSeconds = Math.floor(diffMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function SubmissionCountdown() {
  const [timeLeft, setTimeLeft] = useState(() =>
    getTimeLeft(MOCK_SUBMISSION_DEADLINE),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(MOCK_SUBMISSION_DEADLINE));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-1 bg-white-0 px-4 py-3">
      <p className="p3 text-medium">Time left to submit</p>
      {timeLeft ? (
        <div className="flex gap-4">
          {(
            [
              ["days", "Days"],
              ["hours", "Hrs"],
              ["minutes", "Min"],
              ["seconds", "Sec"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex flex-col items-center">
              <span className="h3 text-heavy">
                {String(timeLeft[key]).padStart(2, "0")}
              </span>
              <span className="p3 text-light">{label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="p2 text-heavy">Submissions are closed</p>
      )}
    </div>
  );
}