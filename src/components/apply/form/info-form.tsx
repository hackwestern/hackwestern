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
import { useAutoSave } from "~/components/hooks/use-auto-save";
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
  const { data } = api.application.get.useQuery();
  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const defaultValues = useMemo(() => {
    if (!data) return data;
    const attendedBefore = data.attendedBefore
      ? ("yes" as const)
      : ("no" as const);
    return {
      ...data,
      attendedBefore,
    };
  }, [data]);

  const form = useForm<z.infer<typeof infoSaveSchema>>({
    resolver: zodResolver(infoSaveSchema),
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof infoSaveSchema>) {
    mutate({
      ...defaultValues,
      ...data,
      attendedBefore: data.attendedBefore === "yes",
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
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
                <RadioButtonGroup {...field} onValueChange={field.onChange}>
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
                <RadioButtonGroup {...field} onValueChange={field.onChange}>
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
