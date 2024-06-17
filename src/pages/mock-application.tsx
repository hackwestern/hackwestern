import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { useForm } from "react-hook-form";

import { api } from "~/utils/api";
import { applicationSaveSchema } from "~/server/api/routers/application";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Combobox } from "~/components/ui/combobox";

const countries = [
  {
    value: "Canada",
    label: "Canada",
  },
  {
    value: "United States",
    label: "United States",
  },
  {
    value: "Other",
    label: "Other",
  },
];

export default function MockApplication() {
  const { data: applicationData, status } = api.application.get.useQuery();
  const { mutate } = api.application.save.useMutation();

  function onSubmit(data: z.infer<typeof applicationSaveSchema>) {
    mutate(data);
  }

  const form = useForm<z.infer<typeof applicationSaveSchema>>({
    resolver: zodResolver(applicationSaveSchema),
    defaultValues: applicationData,
    mode: "onBlur",
  });
  return (
    <main className="flex min-h-screen flex-col items-center justify-center py-5">
      <div className="flex justify-center">
        <div className="3xl:grid-cols-5 3xl:grid-cols-4 container grid grid-cols-1 items-center gap-6 px-4 md:grid-cols-2 xl:grid-cols-3">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
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
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
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
                        type="number"
                        {...field}
                        value={field.value ?? 0}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="countryOfResidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Combobox
                        {...field}
                        options={countries}
                        value={field.value ?? undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="bg-white text-black hover:bg-gray-300"
              >
                Submit
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </main>
  );
}
