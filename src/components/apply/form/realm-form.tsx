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

  const formHorseId = form.watch("horseId");

  // Local optimistic highlight so the picked horse is re-highlighted on the
  // very next frame — independent of RHF/server round-trips. Falls back to
  // whatever the form/server says once no pending pick is set.
  const [pendingHorseId, setPendingHorseId] = React.useState<number | null>(
    null,
  );
  const highlightedHorseId = pendingHorseId ?? formHorseId ?? null;

  // Clear the local override once the server confirms it (or any other value).
  React.useEffect(() => {
    if (pendingHorseId == null) return;
    if (defaults?.horseId === pendingHorseId) setPendingHorseId(null);
  }, [defaults?.horseId, pendingHorseId]);

  const handlePick = (horse: Horse) => {
    if (!canEdit) return;
    // 1. Flip the visible highlight immediately — before any RHF/network work.
    setPendingHorseId(horse.id);
    // 2. Mirror into form state (keeps the companion step in sync).
    form.setValue("horseId", horse.id, { shouldDirty: true });
    form.setValue("realm", horse.realm, { shouldDirty: true });
    // 3. Persist + refetch.
    mutate(
      {
        realm: horse.realm,
        horseId: horse.id,
        horseFirstName: defaults?.horseFirstName ?? null,
        horseLastName: defaults?.horseLastName ?? null,
      } as RealmFormValues,
      {
        onSuccess: () => utils.application.get.invalidate(),
      },
    );
  };

  return (
    <Form {...form}>
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <HorsePicker selectedId={highlightedHorseId} onSelect={handlePick} />
      </div>
    </Form>
  );
}
