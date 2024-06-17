import type { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Combobox } from "~/components/ui/combobox";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "~/utils/api";
import { applicationSaveSchema } from "~/schemas/application";
import { skipToken } from "@tanstack/react-query";

const countries = ["Canada", "United States", "Other"].map((c) => ({
  value: c,
  label: c,
}));

const schools = [
  "Western University",
  "University of Waterloo",
  "McMaster University",
  "York University",
  "Laurier University",
  "The University of Toronto",
  "The University of Toronto Mississauga",
  "The University of Toronto Scarborough",
  "Other",
  "N/A",
].map((c) => ({
  value: c,
  label: c,
}));

const levelOfStudy = [
  "Less than Secondary / High School",
  "Secondary / High School",
  "Undergraduate University (2 year - community college etc.)",
  "Undergraduate University (3+ year)",
  "Graduate University (Masters, Professional, Doctoral, etc)",
  "Code School / Bootcamp",
  "Other Vocational / Trade Program or Apprenticeship",
  "Post Doctorate",
  "Other",
  "Not currently a student",
  "Prefer not to answer",
].map((c) => ({
  value: c,
  label: c,
}));

const majors = [
  "Computer Science",
  "Computer Engineering",
  "Software Engineering",
  "Other Engineering Discipline",
  "Information Systems",
  "Information Technology",
  "System Administration",
  "Natural Sciences (Biology, Chemistry, Physics, etc.)",
  "Mathematics/Statistics",
  "Web Development/Web Design",
  "Business Administration",
  "Humanities",
  "Social Science",
  "Fine Arts/Performing Arts",
  "Other",
].map((c) => ({
  value: c,
  label: c,
}));

export default function MockApplication() {
  const { data: applicationData } = api.application.get.useQuery(skipToken, {
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
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
                  <FormItem className="flex flex-col py-2">
                    <FormLabel>Country</FormLabel>
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
              <FormField
                control={form.control}
                name="countryOfResidence"
                render={({ field }) => (
                  <FormItem className="flex flex-col py-2">
                    <FormLabel>School</FormLabel>
                    <FormControl>
                      <Combobox
                        {...field}
                        options={schools}
                        value={field.value ?? undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="major"
                render={({ field }) => (
                  <FormItem className="flex flex-col py-2">
                    <FormLabel>Major</FormLabel>
                    <FormControl>
                      <Combobox
                        {...field}
                        options={majors}
                        value={field.value ?? undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">Submit</Button>
            </form>
          </Form>
        </div>
      </div>
    </main>
  );
}
