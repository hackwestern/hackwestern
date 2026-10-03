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
import { Input } from "~/components/ui/input";
import { api } from "~/utils/api";
import { useAutoSave } from "~/hooks/use-auto-save";
import { logisticsSaveSchema } from "~/schemas/application";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { RadioButtonGroup, RadioButtonItem } from "~/components/ui/radio-group";
import {
  dietaryRestrictions,
  emergencyContactRelationship,
  shirtSize,
} from "~/server/db/schema";
import { useCanEditApplication } from "~/hooks/use-can-edit-application";

export function LogisticsForm() {
  const utils = api.useUtils();
  const { data } = api.application.get.useQuery({
    fields: [
      "status",
      "shirtSize",
      "dietaryRestrictions",
      "dietaryRestrictionsOther",
      "emergencyContactName",
      "emergencyContactRelationship",
      "emergencyContactPhoneNumber",
    ],
  });

  const status = data?.status ?? "NOT_STARTED";
  const canEdit = useCanEditApplication(status);

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  // The database stores unselected fields as `null`, but the zod schema
  // expects optional (string | undefined) — convert null -> undefined.
  const defaultValues = useMemo(() => {
    if (!data) return data;
    return {
      shirtSize: data.shirtSize ?? undefined,
      dietaryRestrictions: data.dietaryRestrictions ?? undefined,
      dietaryRestrictionsOther: data.dietaryRestrictionsOther ?? undefined,
      emergencyContactName: data.emergencyContactName ?? undefined,
      emergencyContactRelationship:
        data.emergencyContactRelationship ?? undefined,
      emergencyContactPhoneNumber:
        data.emergencyContactPhoneNumber ?? undefined,
    };
  }, [data]);

  const form = useForm<z.infer<typeof logisticsSaveSchema>>({
    resolver: zodResolver(logisticsSaveSchema),
    defaultValues: defaultValues ?? undefined,
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(formData: z.infer<typeof logisticsSaveSchema>) {
    mutate({
      ...formData,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="shirtSize"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is your shirt size? *</FormLabel>
              <FormControl>
                <RadioButtonGroup
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  {shirtSize.enumValues.map((option) => (
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
          name="dietaryRestrictions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What are your dietary restrictions? *</FormLabel>
              <FormControl>
                <RadioButtonGroup
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  {dietaryRestrictions.enumValues.map((option) => (
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
          name="dietaryRestrictionsOther"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                If selected Other then tell us more (optional)
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="e.g. gluten-free"
                  variant="primary"
                  disabled={!canEdit}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="emergencyContactName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Emergency contact name *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="Jane Doe"
                  variant="primary"
                  disabled={!canEdit}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="emergencyContactRelationship"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Emergency contact relationship *</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {emergencyContactRelationship.enumValues.map((item) => (
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
          name="emergencyContactPhoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Emergency contact phone number *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  type="tel"
                  placeholder="Enter their phone number"
                  variant="primary"
                  disabled={!canEdit}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
