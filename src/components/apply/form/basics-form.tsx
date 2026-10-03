import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { api } from "~/utils/api";
import { useAutoSave } from "~/hooks/use-auto-save";
import { basicsSaveSchema } from "~/schemas/application";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { countrySelection } from "~/server/db/schema";
import { useCanEditApplication } from "~/hooks/use-can-edit-application";

export function BasicsForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery({
    fields: [
      "status",
      "firstName",
      "lastName",
      "phoneNumber",
      "age",
      "countryOfResidence",
    ],
  });
  const status = defaultValues?.status ?? "NOT_STARTED";

  const canEdit = useCanEditApplication(status);

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof basicsSaveSchema>>({
    resolver: zodResolver(basicsSaveSchema),
    defaultValues: defaultValues as z.infer<typeof basicsSaveSchema>,
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof basicsSaveSchema>) {
    mutate({
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 md:space-y-8 md:pb-4"
      >
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder="First Name"
                    variant="primary"
                    disabled={!canEdit}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Last Name"
                    variant="primary"
                    disabled={!canEdit}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  type="tel"
                  placeholder="Enter your phone number"
                  variant="primary"
                  disabled={!canEdit}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Age</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      field.onChange(null);
                    } else {
                      const n = Number(v);
                      if (Number.isNaN(n)) return;
                      field.onChange(Math.max(0, n));
                    }
                  }}
                  type="number"
                  value={field.value ?? ""}
                  placeholder="Enter your age"
                  variant={(field.value ?? 18) >= 18 ? "primary" : "invalid"}
                  disabled={!canEdit}
                />
              </FormControl>
              {(field.value ?? 18) < 18 && (
                <FormDescription className="text-destructive">
                  You must be 18 years of age by November 20, 2026.
                </FormDescription>
              )}
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="countryOfResidence"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Country of Residence</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countrySelection.enumValues.map((item) => (
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
