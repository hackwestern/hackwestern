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

export function SavedIndicator() {
  const { data: application } = api.application.get.useQuery();
  const isSaving = useIsMutating();

  const formattedLastSavedAt = formattedDate(application?.updatedAt ?? null);

  if (isSaving) {
    return (
      <div className="flex items-center gap-1 text-xs italic text-slate-400">
        <Spinner isLoading className="size-3 fill-primary-100 text-slate-400" />
        <span>Saving</span>
      </div>
    );
  }

  if (formattedLastSavedAt) {
    return (
      <div className="text-right text-xs italic text-slate-400">
        Last Saved:
        <br />
        {formattedLastSavedAt}
      </div>
    );
  }

  return <></>;
}
