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
import { Button } from "~/components/ui/button";
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

  // Start on the picker and only hop to the naming view once defaults have
  // actually loaded with both a saved horse and a saved name. Doing it this
  // way means the picker always shows even if the defaults query is slow,
  // errors out, or returns an empty row.
  const [view, setView] = React.useState<"pick" | "name">("pick");
  const didResolveInitialViewRef = React.useRef(false);

  React.useEffect(() => {
    if (didResolveInitialViewRef.current || !defaults) return;
    const savedHorse = getHorse(defaults.horseId);
    const savedName = defaults.horseFirstName && defaults.horseLastName;
    if (savedHorse && savedName) setView("name");
    didResolveInitialViewRef.current = true;
  }, [defaults]);

  const handlePick = (horse: Horse) => {
    if (!canEdit) return;
    form.setValue("horseId", horse.id, { shouldDirty: true });
    form.setValue("realm", horse.realm, { shouldDirty: true });
  };

  const handleConfirmPick = () => {
    if (!selectedHorse) return;
    setView("name");
  };

  const handleChangeHorse = () => {
    if (!canEdit) return;
    setView("pick");
  };

  const hasNames = Boolean(horseFirstName && horseLastName);

  // Guard: if we're meant to be on the naming view but the saved horseId is
  // somehow unknown, fall back to the picker instead of crashing on
  // selectedHorse.asset.
  const showPick = view === "pick" || !selectedHorse;

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
            className="flex flex-col items-center gap-6"
          >
            <HorsePicker selectedId={horseId ?? null} onSelect={handlePick} />
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={!selectedHorse || !canEdit}
              onClick={handleConfirmPick}
            >
              Next
            </Button>
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
