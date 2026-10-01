/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { api } from "~/utils/api";
import { useAutoSave } from "~/hooks/use-auto-save";
import { realmSaveSchema } from "~/schemas/application";
import { getHorse, realmLabel, type Horse } from "~/constants/realms";
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
    defaultValues: defaults as RealmFormValues,
  });

  const onSubmit = React.useCallback(
    (data: RealmFormValues) => mutate(data),
    [mutate],
  );

  useAutoSave(form, onSubmit, defaults);

  const horseId = form.watch("horseId");
  const horseFirstName = form.watch("horseFirstName");
  const horseLastName = form.watch("horseLastName");
  const selectedHorse = getHorse(horseId);

  const handlePick = (horse: Horse) => {
    if (!canEdit) return;
    form.setValue("horseId", horse.id, { shouldDirty: true });
    form.setValue("realm", horse.realm, { shouldDirty: true });
  };

  const handleChangeHorse = () => {
    if (!canEdit) return;
    form.setValue("horseId", null, { shouldDirty: true });
    form.setValue("realm", null, { shouldDirty: true });
  };

  if (!selectedHorse) {
    return (
      <Form {...form}>
        <HorsePicker selectedId={horseId ?? null} onSelect={handlePick} />
      </Form>
    );
  }

  return (
    <Form {...form}>
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <p className="font-primary text-sm-display font-bold text-heavy">
            {horseFirstName && horseLastName
              ? `${horseFirstName} ${horseLastName} will be your companion for Hack Western 13!`
              : "Name your horse companion"}
          </p>
          <p className="mt-2 font-figtree text-lg-p font-medium text-light">
            You will be journeying through the{" "}
            <span className="font-semibold text-medium">
              {realmLabel[selectedHorse.realm]}
            </span>{" "}
            realm.
          </p>
        </div>

        <div className="relative w-full max-w-[420px]">
          <img
            src={selectedHorse.asset}
            alt={`${realmLabel[selectedHorse.realm]} horse`}
            className="mx-auto h-auto w-full select-none"
            draggable={false}
          />
        </div>

        <div className="grid w-full max-w-[600px] grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="horseFirstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    disabled={!canEdit}
                    placeholder="Wobbly"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="horseLastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    disabled={!canEdit}
                    placeholder="Biscuit"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleChangeHorse}
            className="font-figtree text-md-p font-medium text-medium underline-offset-2 hover:underline"
          >
            Pick a different horse
          </button>
        )}
      </div>
    </Form>
  );
}
