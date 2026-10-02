/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "~/components/ui/form";
import { api } from "~/utils/api";
import { realmSaveSchema } from "~/schemas/application";
import { type Horse } from "~/constants/realms";
import { HorsePicker } from "./horse-picker";

type RealmFormValues = z.infer<typeof realmSaveSchema>;

export function RealmForm() {
  const utils = api.useUtils();
  const { data: defaults } = api.application.get.useQuery({
    fields: ["status", "realm", "horseId", "horseFirstName", "horseLastName"],
  });

  const status = defaults?.status ?? "NOT_STARTED";
  const canEdit = status === "NOT_STARTED" || status === "IN_PROGRESS";

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => utils.application.get.invalidate(),
  });

  const form = useForm<RealmFormValues>({
    resolver: zodResolver(realmSaveSchema),
    values: (defaults ?? {
      realm: null,
      horseId: null,
      horseFirstName: null,
      horseLastName: null,
    }) as RealmFormValues,
    resetOptions: { keepDirtyValues: true },
  });

  // Highlight is pure local state so a click paints on the very next frame
  // without waiting for RHF subscriptions or the server round-trip. The
  // effect below just keeps it mirrored to whatever the server last confirmed.
  const [highlightedId, setHighlightedId] = React.useState<number | null>(
    defaults?.horseId ?? null,
  );

  React.useEffect(() => {
    if (defaults?.horseId != null && defaults.horseId !== highlightedId) {
      setHighlightedId(defaults.horseId);
    }
    // We only want to react to server-side changes here; local optimistic
    // picks are handled by handlePick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults?.horseId]);

  const handlePick = (horse: Horse) => {
    if (!canEdit) return;
    // Flip the highlight synchronously. This is the only state the picker
    // reads, so React re-renders it immediately with the new selection.
    setHighlightedId(horse.id);
    // Mirror into form state so the companion step picks it up.
    form.setValue("horseId", horse.id, { shouldDirty: true });
    form.setValue("realm", horse.realm, { shouldDirty: true });
    // Persist + refetch.
    mutate(
      {
        realm: horse.realm,
        horseId: horse.id,
        horseFirstName: defaults?.horseFirstName ?? null,
        horseLastName: defaults?.horseLastName ?? null,
      } as RealmFormValues,
      {
        onSuccess: () => {
          void utils.application.get.invalidate();
        },
      },
    );
  };

  return (
    <Form {...form}>
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <HorsePicker selectedId={highlightedId} onSelect={handlePick} />
      </div>
    </Form>
  );
}
