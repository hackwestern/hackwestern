import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
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

const travelLabel = (
  option: (typeof transportationMethod.enumValues)[number],
) =>
  option === OWN_TRAVEL
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="transportationMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>How are you getting to Hack Western? *</FormLabel>
              {errors.transportationMethod && (
                <FieldError>{errors.transportationMethod}</FieldError>
              )}
              <FormControl>
                <RadioButtonGroup
                  // "" = nothing picked yet; undefined would leave the group
                  // uncontrolled until the saved answer loads.
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  className="flex-col flex-nowrap gap-3"
                >
                  {transportationMethod.enumValues.map((option) => (
                    <RadioButtonItem
                      className="w-full"
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
        {ownTravel && (
          <FormField
            control={form.control}
            name="travelReimbursement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Do you want to request a partial ticket reimbursement? *
                </FormLabel>
                {errors.travelReimbursement && (
                  <FieldError>{errors.travelReimbursement}</FieldError>
                )}
                <FormDescription>
                  For bus, train or flight tickets. We&apos;ll confirm the
                  details by email.
                </FormDescription>
                <FormControl>
                  <RadioButtonGroup
                    value={
                      field.value == null ? "" : field.value ? "yes" : "no"
                    }
                    onValueChange={(value) => field.onChange(value === "yes")}
                    className="grid grid-cols-2 gap-3"
                  >
                    <RadioButtonItem
                      className="w-full"
                      label="Yes"
                      value="yes"
                    />
                    <RadioButtonItem className="w-full" label="No" value="no" />
                  </RadioButtonGroup>
                </FormControl>
              </FormItem>
            )}
          />
        )}
        {ownTravel && reimbursement && (
          <FormField
            control={form.control}
            name="travelFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Which city are you travelling from? *</FormLabel>
                {errors.travelFrom && (
                  <FieldError>{errors.travelFrom}</FieldError>
                )}
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder="e.g. Ottawa"
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
