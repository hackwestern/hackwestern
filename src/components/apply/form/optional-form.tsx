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
import {
  type UnderrepGroupAnswer,
  optionalSaveSchema,
  underrepGroupAnswers,
} from "~/schemas/application";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { ethnicity, gender, sexualOrientation } from "~/server/db/schema";
import { RadioButtonGroup, RadioButtonItem } from "~/components/ui/radio-group";

function getUnderrepGroup(underrepGroup: boolean | null) {
  if (underrepGroup === null) {
    return "Prefer not to answer" as const;
  }
  return underrepGroup ? ("Yes" as const) : ("No" as const);
}

function isUnderrepGroup(answer: UnderrepGroupAnswer) {
  switch (answer) {
    case "Prefer not to answer":
      return null;
    case "Yes":
      return true;
    default:
      return false;
  }
}

export function OptionalForm() {
  const utils = api.useUtils();
  const { data } = api.application.get.useQuery();
  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const defaultValues = useMemo(() => {
    if (!data) return data;
    const underrepGroup = getUnderrepGroup(data.underrepGroup);
    return {
      ...data,
      underrepGroup,
    };
  }, [data]);

  const form = useForm<z.infer<typeof optionalSaveSchema>>({
    resolver: zodResolver(optionalSaveSchema),
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof optionalSaveSchema>) {
    const underrepGroup = isUnderrepGroup(data.underrepGroup);
    mutate({
      ...defaultValues,
      ...data,
      underrepGroup,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <FormField
          control={form.control}
          name="underrepGroup"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Do you identify as part of an underrepresented group in the
                technology industry?
              </FormLabel>
              <FormControl>
                <RadioButtonGroup {...field} onValueChange={field.onChange}>
                  {underrepGroupAnswers.map((option) => (
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
        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is your gender?</FormLabel>
              <FormControl>
                <RadioButtonGroup
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                >
                  {gender.enumValues.map((option) => (
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
        <FormField
          control={form.control}
          name="ethnicity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is your race/ethnicity?</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select race/ethnicity" />
                  </SelectTrigger>
                  <SelectContent>
                    {ethnicity.enumValues.map((item) => (
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
          name="sexualOrientation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is your sexual orientation?</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select sexual/orientation" />
                  </SelectTrigger>
                  <SelectContent>
                    {sexualOrientation.enumValues.map((item) => (
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
      </form>
    </Form>
  );
}
