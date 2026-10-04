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
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { api } from "~/utils/api";
import { useAutoSave } from "~/hooks/use-auto-save";
import { HORSE_NAME_MAX_LENGTH, realmSaveSchema } from "~/schemas/application";
import { getHorse, realmLabel } from "~/constants/realms";
import { useCanEditApplication } from "~/hooks/use-can-edit-application";

type CompanionFormValues = z.infer<typeof realmSaveSchema>;

export function CompanionForm() {
  const utils = api.useUtils();
  const { data: defaults } = api.application.get.useQuery({
    fields: ["status", "realm", "horseId", "horseFirstName", "horseLastName"],
  });

  const status = defaults?.status ?? "NOT_STARTED";
  const canEdit = useCanEditApplication(status);

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
      <div className="flex flex-col items-center gap-10 pb-12 pt-6">
        <div className="text-center">
          {/* Room reserved for the named version (3 lines on phones, 2 from sm),
              so typing a name doesn't push the horse down. */}
          <p className="flex min-h-[3.75em] items-center justify-center text-balance font-primary text-lg-p font-bold leading-tight text-heavy sm:min-h-[2.5em] sm:text-sm-display">
            {hasNames
              ? `${horseFirstName} ${horseLastName} will be your companion for Hack Western 13!`
              : "Good choice! Next, pick a name for your companion"}
          </p>
          <p className="mt-1 font-figtree text-md-p font-medium text-light">
            You will be journeying through the{" "}
            <span className="font-semibold text-medium">
              {realmLabel[selectedHorse.realm]}
            </span>{" "}
            realm.
          </p>
        </div>

        <div className="relative w-full max-w-[360px]">
          <img
            src={selectedHorse.asset}
            alt={`${realmLabel[selectedHorse.realm]} horse`}
            className="mx-auto max-h-[260px] w-auto max-w-full select-none object-contain"
            draggable={false}
          />
        </div>

        <div className="grid w-full max-w-[600px] grid-cols-1 gap-3 sm:grid-cols-2">
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
                    maxLength={HORSE_NAME_MAX_LENGTH}
                  />
                </FormControl>
                <FormMessage />
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
                    maxLength={HORSE_NAME_MAX_LENGTH}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </Form>
  );
}
