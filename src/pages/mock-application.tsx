import React from "react";
import type { z } from "zod";
import {
  Form,
  FormControl,
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
  const {
    data: applicationData,
    isLoading,
    isError,
  } = api.application.get.useQuery(void 0, {
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const { mutate } = api.application.save.useMutation();

  function onSubmit(data: z.infer<typeof applicationSaveSchema>) {
    console.log(data);
    mutate(data);
  }

  const applicationForm = useForm<z.infer<typeof applicationSaveSchema>>({
    resolver: zodResolver(applicationSaveSchema),
    defaultValues: applicationData,
    values: applicationData,
  });

  React.useEffect(() => {
    console.log({ values: applicationForm, applicationData });
    applicationForm.reset(applicationData);
  }, [applicationData, applicationForm]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center py-5">
      <div className="flex justify-center">
        {isLoading && "loading..."}
        {!isLoading && (
          <div className="flex max-w-full flex-row gap-5">
            <Form {...applicationForm}>
              <form
                onSubmit={applicationForm.handleSubmit(onSubmit)}
                onChange={() => console.log(applicationForm.getValues())}
                className="w-96"
              >
                <FormField
                  control={applicationForm.control}
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
                  control={applicationForm.control}
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
                  control={applicationForm.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Age</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          value={field.value ? Number(field.value) : 0}
                          onChange={(event) => {
                            applicationForm.setValue(
                              "age",
                              event.target.valueAsNumber,
                            );
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={applicationForm.control}
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
                  control={applicationForm.control}
                  name="countryOfResidence"
                  render={({ field }) => (
                    <FormItem className="flex flex-col py-2">
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Combobox
                          {...field}
                          options={countries}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={applicationForm.control}
                  name="school"
                  render={({ field }) => (
                    <FormItem className="flex flex-col py-2">
                      <FormLabel>School</FormLabel>
                      <FormControl {...field}>
                        <Combobox
                          options={schools}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={applicationForm.control}
                  name="levelOfStudy"
                  render={({ field }) => (
                    <FormItem className="flex flex-col py-2">
                      <FormLabel>What is your level of study?</FormLabel>
                      <FormControl>
                        <Combobox
                          {...field}
                          options={levelOfStudy}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={applicationForm.control}
                  name="major"
                  render={({ field }) => (
                    <FormItem className="flex flex-col py-2">
                      <FormLabel>Major</FormLabel>
                      <FormControl>
                        <Combobox
                          {...field}
                          options={majors}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit">Submit</Button>
              </form>
            </Form>
            <pre className="w-96 overflow-x-scroll">
              {JSON.stringify(applicationForm.getValues(), null, " ")}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
