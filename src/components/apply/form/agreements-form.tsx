import { useAutoSave } from "~/hooks/use-auto-save";
import { api } from "~/utils/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import type { z } from "zod";
import { agreementsSaveSchema } from "~/schemas/application";
import { Checkbox } from "~/components/ui/checkbox";
import Link from "next/link";

const StyledLink = ({ url, text }: { url: string; text: string }) => {
  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary-600 underline hover:text-primary-500"
    >
      {text}
    </Link>
  );
};

export function AgreementsForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery({
    fields: [
      "status",
      "agreeCodeOfConduct",
      "agreeShareWithMLH",
      "agreeShareWithSponsors",
      "agreeWillBe18",
      "agreeEmailsFromMLH",
    ],
  });

  const status = defaultValues?.status ?? "NOT_STARTED";
  const canEdit = status == "NOT_STARTED" || status == "IN_PROGRESS";

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof agreementsSaveSchema>>({
    resolver: zodResolver(agreementsSaveSchema),
  });

  const FIELDS: Array<keyof z.infer<typeof agreementsSaveSchema>> = [
    "agreeCodeOfConduct",
    "agreeShareWithMLH",
    "agreeShareWithSponsors",
    "agreeWillBe18",
    "agreeEmailsFromMLH",
  ];

  useAutoSave(form, onSubmit, defaultValues, { fields: FIELDS });

  function onSubmit(data: z.infer<typeof agreementsSaveSchema>) {
    mutate({
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <FormField
          control={form.control}
          name="agreeCodeOfConduct"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl className="mt-1.5">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value)}
                  disabled={!canEdit}
                />
              </FormControl>
              <FormLabel className="text-sm text-slate-500">
                I have read and agree to the{" "}
                <StyledLink
                  url="https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md "
                  text="MLH Code of Conduct"
                />
              </FormLabel>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="agreeShareWithMLH"
          render={({ field }) => (
            <FormItem className="flex gap-2">
              <FormControl className="mt-1.5">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value)}
                  disabled={!canEdit}
                />
              </FormControl>
              <FormLabel className="text-sm text-slate-500">
                I authorize Hack Western to share my application/registration
                information with Major League Hacking for event administration,
                ranking, and MLH administration in-line with the{" "}
                <StyledLink
                  url="https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md"
                  text="MLH Privacy Policy"
                />
                . I further agree to the terms of the{" "}
                <StyledLink
                  url="https://github.com/MLH/mlh-policies/blob/main/contest-terms.md"
                  text="MLH Contest Terms and Conditions"
                />
              </FormLabel>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="agreeShareWithSponsors"
          render={({ field }) => (
            <FormItem className="flex gap-2">
              <FormControl className="mt-1.5">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value)}
                  disabled={!canEdit}
                />
              </FormControl>
              <FormLabel className="text-sm text-slate-500">
                I give Hack Western permission to share my information with
                sponsors
              </FormLabel>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="agreeWillBe18"
          render={({ field }) => (
            <FormItem className="flex gap-2">
              <FormControl className="mt-1.5">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value)}
                  disabled={!canEdit}
                />
              </FormControl>
              <FormLabel className="text-sm text-slate-500">
                I will be at least 18 years old on November 21st, 2025
              </FormLabel>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="agreeEmailsFromMLH"
          render={({ field }) => (
            <FormItem className="flex gap-2">
              <FormControl className="mt-1.5">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value)}
                  disabled={!canEdit}
                />
              </FormControl>
              <FormLabel className="text-sm text-slate-500">
                <b>(Optional)</b> I authorize MLH to send me occasional emails
                about relevant events, career opportunities, and community
                announcements.
              </FormLabel>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
