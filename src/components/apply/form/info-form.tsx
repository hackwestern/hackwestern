import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { api } from "~/utils/api";
import { useAutoSave } from "~/hooks/use-auto-save";
import { infoSaveSchema } from "~/schemas/application";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { schools } from "~/constants/schools";
import { levelOfStudy, major, numOfHackathons } from "~/server/db/schema";
import { RadioButtonGroup, RadioButtonItem } from "~/components/ui/radio-group";

export function InfoForm() {
  const utils = api.useUtils();
  const { data } = api.application.get.useQuery({
    fields: [
      "status",
      "school",
      "levelOfStudy",
      "major",
      "attendedBefore",
      "numOfHackathons",
    ],
  });

  const status = data?.status ?? "NOT_STARTED";
  const canEdit = status == "NOT_STARTED" || status == "IN_PROGRESS";

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  // Transform the form values for display
  const formValues = useMemo(() => {
    if (!data) return undefined;
    return {
      major: data.major ?? undefined,
      school:
        (data.school as (typeof schools)[number] | undefined) ?? undefined,
      levelOfStudy: data.levelOfStudy ?? undefined,
      numOfHackathons: data.numOfHackathons ?? undefined,
      attendedBefore:
        data.attendedBefore === true
          ? "yes"
          : data.attendedBefore === false
            ? "no"
            : undefined,
    } satisfies z.infer<typeof infoSaveSchema>;
  }, [data]);

  const form = useForm<z.infer<typeof infoSaveSchema>>({
    resolver: zodResolver(infoSaveSchema),
    defaultValues: formValues, // Use the complete data object
  });

  useAutoSave(form, onSubmit, formValues);

  function onSubmit(formData: z.infer<typeof infoSaveSchema>) {
    if (!data) return;
    mutate({
      ...formData, // Override with new form values
      attendedBefore:
        formData.attendedBefore === "yes"
          ? true
          : formData.attendedBefore === "no"
            ? false
            : undefined,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="school"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Which school do you attend?</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="levelOfStudy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is your level of study?</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select level of study" />
                  </SelectTrigger>
                  <SelectContent>
                    {levelOfStudy.enumValues.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="major"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is your major?</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select major" />
                  </SelectTrigger>
                  <SelectContent>
                    {major.enumValues.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="attendedBefore"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Have you attended Hack Western before?</FormLabel>
              <FormControl>
                <RadioButtonGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <RadioButtonItem key="yes" label="Yes" value="yes" />
                  <RadioButtonItem key="no" label="No" value="no" />
                </RadioButtonGroup>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="numOfHackathons"
          render={({ field }) => (
            <FormItem>
              <FormLabel>How many hackathons have you attended?</FormLabel>
              <FormControl>
                <RadioButtonGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  {numOfHackathons.enumValues.map((option) => (
                    <RadioButtonItem
                      key={option}
                      label={option}
                      value={option}
                    />
                  ))}
                </RadioButtonGroup>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
