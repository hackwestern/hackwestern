import { useIsMutating } from "@tanstack/react-query";
import { format } from "date-fns";
import { api } from "~/utils/api";
import { Spinner } from "../loading-spinner";

export function formattedDate(lastSaved: Date | null): string | null {
  if (!lastSaved) {
    return null;
  }
  return format(lastSaved, "MMM d, h:mm a");
}

export function formattedLastSavedAt(lastSaved: Date | null): string | null {
  if (!lastSaved) {
    return null;
  }

  const now = new Date();
  const diffInSeconds = Math.floor(
    (now.getTime() - lastSaved.getTime()) / 1000,
  );

  if (diffInSeconds <= 5) {
    return "just now";
  } else if (diffInSeconds < 30) {
    return `a few seconds ago`;
  } else if (diffInSeconds < 120) {
    return `a minute ago`;
  } else if (diffInSeconds < 600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minutes ago`;
  } else {
    return format(lastSaved, "MMM d, h:mm a");
  }
}

export function SavedIndicator() {
  const { data: application } = api.application.get.useQuery(void 0, {
    refetchInterval: 5000,
  });
  const isSaving = useIsMutating();

  return (
    <SavedIndicatorComponent
      isSaving={isSaving > 0}
      lastSaved={application?.updatedAt ?? null}
    />
  );
}

export function SavedIndicatorComponent({
  isSaving,
  lastSaved,
}: {
  isSaving: boolean;
  lastSaved: Date | null;
}) {
  const formattedLastSaved = formattedLastSavedAt(lastSaved);

  if (isSaving) {
    return (
      <div className="flex items-center gap-1 text-xs italic text-heavy">
        <Spinner isLoading className="size-3 fill-primary-100 text-heavy" />
        <span>Saving</span>
      </div>
    );
  }

  if (formattedLastSaved) {
    return (
      <div className="mt-2 text-sm font-medium italic text-heavy">
        Last saved {formattedLastSaved}
      </div>
    );
  }
}
