/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion, type Easing } from "framer-motion";
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

const viewFade = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.37, 0.1, 0.6, 1] as Easing },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: [0.37, 0.1, 0.6, 1] as Easing },
  },
};

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

  // Use `values` (reactive) instead of `defaultValues` (one-shot) so RHF
  // re-syncs the form every time the server data refetches. keepDirtyValues
  // preserves whatever the user is currently editing (e.g. half-typed
  // horse name) across refetches.
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

  // Text fields (first/last name) keep their debounced auto-save.
  const onSubmit = React.useCallback(
    (data: RealmFormValues) => mutate(data),
    [mutate],
  );
  useAutoSave(form, onSubmit, defaults);

  const horseId = form.watch("horseId");
  const horseFirstName = form.watch("horseFirstName");
  const horseLastName = form.watch("horseLastName");
  const selectedHorse = getHorse(horseId);

  // The view is derived from server state: if the server has a horse saved
  // for us, start on the naming view; otherwise show the picker. Users can
  // override temporarily (handleChangeHorse) via forcedView.
  const [forcedView, setForcedView] = React.useState<"pick" | null>(null);
  const serverHorseId = defaults?.horseId ?? null;
  React.useEffect(() => {
    // Clear the manual override as soon as the server confirms a new pick.
    if (serverHorseId && forcedView === "pick") setForcedView(null);
  }, [serverHorseId, forcedView]);

  const handlePick = (horse: Horse) => {
    if (!canEdit) return;
    // Optimistic local update so the UI flips immediately.
    form.setValue("horseId", horse.id, { shouldDirty: true });
    form.setValue("realm", horse.realm, { shouldDirty: true });
    setForcedView(null);
    // Persist the pick NOW (no 750 ms debounce) and refetch on success so
    // the frontend state is driven by the server row rather than by local
    // RHF state alone.
    mutate(
      {
        realm: horse.realm,
        horseId: horse.id,
        horseFirstName: horseFirstName ?? null,
        horseLastName: horseLastName ?? null,
      } as RealmFormValues,
      {
        onSuccess: () => utils.application.get.invalidate(),
      },
    );
  };

  const handleChangeHorse = () => {
    if (!canEdit) return;
    setForcedView("pick");
  };

  const hasNames = Boolean(horseFirstName && horseLastName);

  // Guard: if we're meant to be on the naming view but the saved horseId is
  // somehow unknown, fall back to the picker instead of crashing on
  // selectedHorse.asset.
  const showPick = forcedView === "pick" || !selectedHorse;

  return (
    <Form {...form}>
      <AnimatePresence mode="wait" initial={false}>
        {showPick ? (
          <motion.div
            key="pick"
            variants={viewFade}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex w-full flex-col items-center gap-4 text-center"
          >
            <div className="w-full">
              <p className="font-primary text-sm-display font-bold text-heavy">
                Click to choose your horse companion
              </p>
              <p className="mt-1 font-figtree text-lg-p font-medium text-light">
                Who will accompany you along this adventure?
              </p>
            </div>
            <HorsePicker selectedId={horseId ?? null} onSelect={handlePick} />
          </motion.div>
        ) : (
          <motion.div
            key="name"
            variants={viewFade}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center gap-6"
          >
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

            {canEdit && (
              <button
                type="button"
                onClick={handleChangeHorse}
                className="font-figtree text-md-p font-medium text-medium underline-offset-2 hover:underline"
              >
                Pick a different horse
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Form>
  );
}
