import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function ScanSuccessPage() {
  const router = useRouter();
  const [activityName, setActivityName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [activityParam, setActivityParam] = useState<string | null>(null);

  useEffect(() => {
    // Get data from query params
    const {
      activity,
      user,
      activityParam: activityParamFromQuery,
    } = router.query;
    if (activity && typeof activity === "string") {
      setActivityName(activity);
    }
    if (user && typeof user === "string") {
      setUserName(user);
    }
    if (activityParamFromQuery && typeof activityParamFromQuery === "string") {
      setActivityParam(activityParamFromQuery);
    }
  }, [router.query]);

  const handleBackToScanning = () => {
    if (activityParam) {
      void router.push(`/scan/${activityParam}`);
    } else {
      void router.push("/scavenger");
    }
  };

  const handleBackToActivities = () => {
    void router.push("/scavenger");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 text-center">
        {/* Success Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Success Message */}
        <h1 className="font-dico text-3xl font-medium text-heavy">
          Scanned Successfully
        </h1>

        {/* Activity Name */}
        {activityName && (
          <div className="space-y-1">
            <p className="font-figtree text-sm text-medium">Activity:</p>
            <p className="font-figtree text-lg font-medium text-heavy">
              {activityName}
            </p>
          </div>
        )}

        {/* User Name */}
        {userName && (
          <div className="space-y-1">
            <p className="font-figtree text-sm text-medium">User:</p>
            <p className="font-figtree text-lg font-medium text-heavy">
              {userName}
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-3">
          {activityParam && (
            <button
              onClick={handleBackToScanning}
              className="w-full rounded-lg bg-primary px-6 py-3 font-figtree font-medium text-primary-foreground transition-colors hover:bg-primary-700"
            >
              Back to Scanning
            </button>
          )}
          <button
            onClick={handleBackToActivities}
            className="mx-auto font-figtree text-sm text-medium underline-offset-4 transition-colors hover:text-heavy hover:underline"
          >
            Back to Activities
          </button>
        </div>
      </div>
    </div>
  );
}
