import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { infoSaveSchema, YEAR_OF_STUDY_OPTIONS } from "~/schemas/application";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { schools } from "~/constants/schools";
import { major, numOfHackathons } from "~/server/db/schema";
import { useCanEditApplication } from "~/hooks/use-can-edit-application";

export function InfoForm() {
  const utils = api.useUtils();
  const { data } = api.application.get.useQuery();

  const status = data?.status ?? "NOT_STARTED";
  const canEdit = useCanEditApplication(status);

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
      schoolOther: data.schoolOther ?? undefined,
      yearOfStudy: data.yearOfStudy ?? undefined,
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
  const school = useWatch({ control: form.control, name: "school" });

  function onSubmit(formData: z.infer<typeof infoSaveSchema>) {
    if (!data) return;
    mutate({
      ...formData, // Override with new form values
      // Only kept while "Other" is picked, so a stale name can't linger
      schoolOther:
        formData.school === "Other" ? (formData.schoolOther ?? null) : null,
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
        {school === "Other" && (
          <FormField
            control={form.control}
            name="schoolOther"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What is the name of your school?</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder="e.g. University of Illinois Urbana-Champaign"
                    maxLength={255}
                    variant="primary"
                    disabled={!canEdit}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="yearOfStudy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is your year of study?</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select year of study" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_OF_STUDY_OPTIONS.map((item) => (
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
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="attendedBefore"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Have you attended Hack Western before?</FormLabel>
                <FormControl>
                  <Select
                    {...field}
                    value={field.value ?? undefined}
                    onValueChange={field.onChange}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Select
                    {...field}
                    value={field.value ?? undefined}
                    onValueChange={field.onChange}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {numOfHackathons.enumValues.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
