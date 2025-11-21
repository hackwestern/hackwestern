import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function AlreadyScannedPage() {
  const router = useRouter();
  const [activityName, setActivityName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    // Get data from query params
    const { activity, user } = router.query;
    if (activity && typeof activity === "string") {
      setActivityName(activity);
    }
    if (user && typeof user === "string") {
      setUserName(user);
    }
  }, [router.query]);

  const handleBackToActivities = () => {
    void router.push("/scavenger");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 text-center">
        {/* Error Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        {/* Error Message */}
        <h1 className="font-dico text-3xl font-medium text-heavy">
          Already Scanned
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

        <p className="font-figtree text-medium">
          This item has already been scanned by this user.
        </p>

        {/* Back Button */}
        <button
          onClick={handleBackToActivities}
          className="w-full rounded-lg bg-primary px-6 py-3 font-figtree font-medium text-primary-foreground transition-colors hover:bg-primary-700"
        >
          Back to Activities
        </button>
      </div>
    </div>
  );
}
