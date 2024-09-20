import { z } from "zod";
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
    defaultValues,
    mode: "onBlur",
  });

  useAutoSave(form, onSubmit);

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
        onBlur={() => console.log(form.getValues())}
        className="space-y-2"
      >
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">Full Name</FormLabel>
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem className="min-w-48 flex-1">
                <FormLabel className="hidden">First Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder="First Name"
                    variant="primary"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem className="min-w-48 flex-1">
                <FormLabel className="hidden">Last Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Last Name"
                    variant="primary"
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
                    if (e.target.value) field.onChange(+e.target.value);
                  }}
                  type="number"
                  value={field.value ? Number(field.value) : undefined}
                  placeholder="Your age as of November 29th, 2024"
                  variant="primary"
                />
              </FormControl>
              <FormDescription>
                You must be 18 years of age by November 29, 2024.
              </FormDescription>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
