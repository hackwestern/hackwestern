import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { RadioButtonGroup, RadioButtonItem } from "~/components/ui/radio-group";
import { CircleAlert } from "lucide-react";
import { api } from "~/utils/api";
import { useAutoSave } from "~/hooks/use-auto-save";
import {
  OWN_TRAVEL,
  rsvpTravelSaveSchema,
  type RsvpTravel,
} from "~/schemas/rsvp";
import { transportationMethod } from "~/server/db/schema";

// RSVP travel step: a Hack Western bus, or getting here on their own
// (which can come with a partial ticket reimbursement request).
// Not on a page yet; it goes into the RSVP flow once that exists.

// One question. Asking for ticket help is its own option: it saves as own
// travel with a reimbursement request, so the stored answer is unchanged.
const TICKET_HELP = "ticket-help";
const TRAVEL_OPTIONS = [...transportationMethod.enumValues, TICKET_HELP];

const travelLabel = (option: string) =>
  option === TICKET_HELP
    ? "I'm coming from farther away and want help with ticket costs"
    : option === OWN_TRAVEL
      ? "I'll get there on my own"
      : `Hack Western bus from ${option}`;

export type TravelErrors = Partial<
  Record<keyof z.infer<typeof rsvpTravelSaveSchema>, string>
>;

/** A required answer that's still missing, shown right under its question. */
export function FieldError({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      data-rsvp-error
      role="alert"
      className={`flex items-center gap-1.5 text-sm text-red-700 ${className}`}
    >
      <CircleAlert aria-hidden className="h-4 w-4 shrink-0" />
      {children}
    </p>
  );
}

export function TravelForm({
  errors = {},
  onChange,
  onSaveRefused,
}: {
  errors?: TravelErrors;
  /** Called with the answer on screen whenever it changes (after loading). */
  onChange?: (values: RsvpTravel) => void;
  /** Called when a save is refused (RSVP closed, or no longer accepted). */
  onSaveRefused?: () => void;
} = {}) {
  const utils = api.useUtils();
  const { data } = api.application.get.useQuery();

  const save = api.application.saveTravel.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
    onError: (err) => {
      if (err.data?.code === "FORBIDDEN") onSaveRefused?.();
    },
  });

  const defaultValues = useMemo(() => {
    if (!data) return data;
    return {
      transportationMethod: data.transportationMethod ?? undefined,
      travelReimbursement: data.travelReimbursement ?? undefined,
      travelFrom: data.travelFrom ?? undefined,
    };
  }, [data]);

  const form = useForm<z.infer<typeof rsvpTravelSaveSchema>>({
    resolver: zodResolver(rsvpTravelSaveSchema),
    defaultValues: defaultValues ?? undefined,
  });

  useAutoSave(form, onSubmit, defaultValues);

  // Report the answer on screen to the page (it confirms with it), once the
  // saved answer has loaded and only when it actually changed.
  const onScreen = useWatch({ control: form.control });
  const lastReported = useRef("");
  useEffect(() => {
    if (!data || !onChange) return;
    const key = JSON.stringify(onScreen);
    if (key === lastReported.current) return;
    lastReported.current = key;
    onChange(onScreen);
  }, [data, onChange, onScreen]);

  function onSubmit(formData: z.infer<typeof rsvpTravelSaveSchema>) {
    save.mutate({ ...formData });
  }

  // useWatch, not form.watch: form.watch doesn't re-render under the React Compiler
  const method = useWatch({
    control: form.control,
    name: "transportationMethod",
  });
  const reimbursement = useWatch({
    control: form.control,
    name: "travelReimbursement",
  });
  const ownTravel = method === OWN_TRAVEL;
  // Own travel with no reimbursement answer yet shows as unpicked.
  const picked = ownTravel
    ? reimbursement === true
      ? TICKET_HELP
      : reimbursement === false
        ? OWN_TRAVEL
        : ""
    : (method ?? "");
  const travelError =
    errors.transportationMethod ??
    (errors.travelReimbursement ? "Tell us how you're getting here" : null);

  function pick(option: string) {
    const set = { shouldDirty: true };
    if (option === TICKET_HELP) {
      form.setValue("transportationMethod", OWN_TRAVEL, set);
      form.setValue("travelReimbursement", true, set);
    } else if (option === OWN_TRAVEL) {
      form.setValue("transportationMethod", OWN_TRAVEL, set);
      form.setValue("travelReimbursement", false, set);
    } else {
      form.setValue(
        "transportationMethod",
        option as (typeof transportationMethod.enumValues)[number],
        set,
      );
      form.setValue("travelReimbursement", null, set);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="transportationMethod"
          render={() => (
            <FormItem>
              <FormLabel>How are you getting to Hack Western? *</FormLabel>
              {travelError && <FieldError>{travelError}</FieldError>}
              <FormControl>
                <RadioButtonGroup
                  // "" = nothing picked yet; undefined would leave the group
                  // uncontrolled until the saved answer loads.
                  value={picked}
                  onValueChange={pick}
                  className="flex-col flex-nowrap gap-3"
                >
                  {TRAVEL_OPTIONS.map((option) => (
                    <RadioButtonItem
                      className="w-full whitespace-normal text-left"
                      key={option}
                      label={travelLabel(option)}
                      value={option}
                    />
                  ))}
                </RadioButtonGroup>
              </FormControl>
            </FormItem>
          )}
        />
        {ownTravel && reimbursement && (
          <FormField
            control={form.control}
            name="travelFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Which city and country are you travelling from? *
                </FormLabel>
                {errors.travelFrom && (
                  <FieldError>{errors.travelFrom}</FieldError>
                )}
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder="e.g. Ottawa, Canada"
                    variant="primary"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}
        {/* Retrying won't fix a refusal; the page refreshes instead. */}
        {save.isError && save.error.data?.code !== "FORBIDDEN" && (
          <FieldError>
            Couldn’t save your answer. Pick it again to retry.
          </FieldError>
        )}
      </form>
    </Form>
  );
}
