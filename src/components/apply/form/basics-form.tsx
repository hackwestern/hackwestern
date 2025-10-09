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
import { useAutoSave } from "~/components/hooks/use-auto-save";
import { basicsSaveSchema } from "~/schemas/application";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { countrySelection } from "~/server/db/schema";

export function BasicsForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery();
  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof basicsSaveSchema>>({
    resolver: zodResolver(basicsSaveSchema),
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof basicsSaveSchema>) {
    mutate({
      ...defaultValues,
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 md:space-y-8"
      >
        <div className="flex w-full flex-col gap-3 md:flex-row md:gap-2">
          <FormLabel className="w-full text-sm font-medium text-gray-700">
            Full Name
          </FormLabel>
          <div className="flex w-full gap-3 md:gap-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="hidden">First Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="First Name"
                      variant="primary"
                      className="form-input-mobile h-12"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="hidden">Last Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Last Name"
                      variant="primary"
                      className="form-input-mobile h-12"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">
                Phone Number
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  type="tel"
                  placeholder="Enter your phone number"
                  variant="primary"
                  className="form-input-mobile h-12"
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
              <FormLabel className="text-sm font-medium text-gray-700">
                Age
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      // allow clearing the field
                      field.onChange(undefined);
                    } else {
                      const n = Number(v);
                      if (Number.isNaN(n)) return;
                      // never allow negative ages
                      field.onChange(Math.max(0, n));
                    }
                  }}
                  type="number"
                  value={field.value ?? ""}
                  min={0}
                  placeholder="Enter your age"
                  variant={(field.value ?? 18) >= 18 ? "primary" : "invalid"}
                  className="form-input-mobile h-12"
                />
              </FormControl>
              {(field.value ?? 18) < 18 && (
                <FormDescription>
                  <p className="text-destructive">
                    You must be 18 years of age by November 21, 2025.
                  </p>
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
              <FormLabel className="text-sm font-medium text-gray-700">
                Your Country of Residence
              </FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="form-input-mobile h-12 w-full">
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
