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
import { getHorse, realmLabel } from "~/constants/realms";

type CompanionFormValues = z.infer<typeof realmSaveSchema>;

export function CompanionForm() {
  const utils = api.useUtils();
  const { data: defaults } = api.application.get.useQuery({
    fields: ["status", "realm", "horseId", "horseFirstName", "horseLastName"],
  });

  const status = defaults?.status ?? "NOT_STARTED";
  const canEdit = status === "NOT_STARTED" || status === "IN_PROGRESS";

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => utils.application.get.invalidate(),
  });

  const form = useForm<CompanionFormValues>({
    resolver: zodResolver(realmSaveSchema),
    values: (defaults ?? {
      realm: null,
      horseId: null,
      horseFirstName: null,
      horseLastName: null,
    }) as CompanionFormValues,
    resetOptions: { keepDirtyValues: true },
  });

  const onSubmit = React.useCallback(
    (data: CompanionFormValues) => mutate(data),
    [mutate],
  );
  useAutoSave(form, onSubmit, defaults);

  const horseFirstName = form.watch("horseFirstName");
  const horseLastName = form.watch("horseLastName");
  const selectedHorse = getHorse(form.watch("horseId"));
  const hasNames = Boolean(horseFirstName && horseLastName);

  if (!selectedHorse) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-primary text-sm-display font-bold text-heavy">
          Pick a horse first
        </p>
        <p className="font-figtree text-md-p font-medium text-light">
          Head back to the Realm step and choose your companion before naming
          them.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <p className="font-primary text-sm-display font-bold text-heavy">
            {hasNames
              ? `${horseFirstName} ${horseLastName} will be your companion for Hack Western 13!`
              : "Good choice! Next, pick a name for your companion"}
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
            className="mx-auto max-h-[240px] w-auto max-w-full select-none object-contain"
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
      </div>
    </Form>
  );
}
