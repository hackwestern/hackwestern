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
import { Checkbox } from "~/components/ui/checkbox";
import { Textarea } from "~/components/ui/textarea";

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

const numHackathons = ["0", "1-3", "4-6", "7+"].map((c) => ({
  value: c,
  label: c,
}));

const gender = [
  "Female",
  "Male",
  "Non-Binary",
  "Other",
  "Prefer not to answer",
].map((c) => ({
  value: c,
  label: c,
}));

const ethnicity = [
  "American Indian or Alaskan Native",
  "Asian / Pacific Islander",
  "Black or African American",
  "Hispanic",
  "White / Caucasian",
  "Multiple ethnicity / Other",
  "Prefer not to answer",
].map((c) => ({
  value: c,
  label: c,
}));

const sexualOrientation = [
  "Asexual / Aromantic",
  "Pansexual, Demisexual or Omnisexual",
  "Bisexual",
  "Queer",
  "Gay / Lesbian",
  "Heterosexual / Straight",
  "Other",
  "Prefer not to answer",
].map((c) => ({
  value: c,
  label: c,
}));

type ApplicationFormProps = {
  defaultValues?: z.infer<typeof applicationSaveSchema>;
};
function ApplicationForm({ defaultValues }: ApplicationFormProps) {
  const { mutate } = api.application.save.useMutation();

  const applicationForm = useForm<z.infer<typeof applicationSaveSchema>>({
    resolver: zodResolver(applicationSaveSchema),
    defaultValues,
  });

  function onSubmit(data: z.infer<typeof applicationSaveSchema>) {
    console.log(data);
    mutate(data);
  }

  return (
    <>
      <Form {...applicationForm}>
        <pre className="fixed right-0 top-0 -z-50 w-96 overflow-x-scroll">
          {JSON.stringify(applicationForm.getValues(), null, " ")}
        </pre>
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
                    options={countries}
                    value={field.value ?? ""}
                    onChange={(value) =>
                      field.onChange({
                        target: { name: field.name, value },
                      })
                    }
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
                    onChange={(value) =>
                      field.onChange({
                        target: { name: field.name, value },
                      })
                    }
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
                    options={levelOfStudy}
                    value={field.value ?? ""}
                    onChange={(value) =>
                      field.onChange({
                        target: { name: field.name, value },
                      })
                    }
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
                    onChange={(value) =>
                      field.onChange({
                        target: { name: field.name, value },
                      })
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="attendedBefore"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <div className="flex items-center gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>Have you attended Hack Western before?</FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="numOfHackathons"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <FormLabel>How many hackathons have you attended?</FormLabel>
                <FormControl>
                  <Combobox
                    {...field}
                    options={numHackathons}
                    value={field.value ?? ""}
                    onChange={(value) =>
                      field.onChange({
                        target: { name: field.name, value },
                      })
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="question1"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <FormLabel>Question 1</FormLabel>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="question2"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <FormLabel>Question 2</FormLabel>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="question3"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <FormLabel>Question 3</FormLabel>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="resumeLink"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <FormLabel>Resume Link</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="githubLink"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <FormLabel>Github Link</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-3">
                    <span>https://github.com/</span>{" "}
                    <Input {...field} value={field.value ?? ""} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="linkedInLink"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <FormLabel>LinkedIn</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-3">
                    <span>https://linkedin.com/in/</span>{" "}
                    <Input {...field} value={field.value ?? ""} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="otherLink"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <FormLabel>Other Link</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="agreeCodeOfConduct"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>
                    I have read and agree to the MLH Code of Conduct.
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="agreeShareWithMLH"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>
                    I authorize you to share my application/registration
                    information with Major League Hacking for event
                    administration, ranking, and MLH administration in-line with
                    the MLH Privacy Policy
                    (https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md).
                    I further agree to the terms of both the MLH Contest Terms
                    and Conditions
                    (https://github.com/MLH/mlh-policies/blob/main/contest-terms.md)
                    and the MLH Privacy Policy
                    (https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md).{" "}
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="agreeShareWithSponsors"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>
                    I give Hack Western Permission to share my information with
                    sponsors.
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="agreeWillBe18"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>
                    I will be at least 18 years old on November [date of
                    hackathon], 2024
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="agreeEmailsFromMLH"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>
                    (Optional) I authorize MLH to send me occasional emails
                    about relevant events, career opportunities, and community
                    announcements.
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={applicationForm.control}
            name="underrepGroup"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={!!field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>
                    Do you identify as part of an underrepresented group in the
                    technology industry?
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="gender"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <FormLabel>What is your gender?</FormLabel>
                <FormControl>
                  <Combobox
                    {...field}
                    options={gender}
                    value={field.value ?? ""}
                    onChange={(value) =>
                      field.onChange({
                        target: { name: field.name, value },
                      })
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="ethnicity"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <FormLabel>What is your ethnicity?</FormLabel>
                <FormControl>
                  <Combobox
                    {...field}
                    options={ethnicity}
                    value={field.value ?? ""}
                    onChange={(value) =>
                      field.onChange({
                        target: { name: field.name, value },
                      })
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={applicationForm.control}
            name="sexualOrientation"
            render={({ field }) => (
              <FormItem className="flex flex-col py-2">
                <FormLabel>What is your sexual orientation?</FormLabel>
                <FormControl>
                  <Combobox
                    {...field}
                    options={sexualOrientation}
                    value={field.value ?? ""}
                    onChange={(value) =>
                      field.onChange({
                        target: { name: field.name, value },
                      })
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Submit</Button>
        </form>
      </Form>
    </>
  );
}

export default function MockApplication() {
  const { data: applicationData, isLoading } = api.application.get.useQuery(
    void 0,
    {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center py-5">
      <div className="flex justify-center">
        {isLoading && "loading..."}
        {!isLoading && (
          <div className="flex max-w-full flex-row gap-5">
            <ApplicationForm defaultValues={applicationData} />
          </div>
        )}
      </div>
    </main>
  );
}
