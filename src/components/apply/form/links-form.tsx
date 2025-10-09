import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ClipboardEvent } from "react";
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
import { linksSaveSchema } from "~/schemas/application";
import {
  getGithubUsername,
  getLinkedinUsername,
  ensureUrlHasProtocol,
} from "~/utils/urls";

export function LinksForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery();
  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof linksSaveSchema>>({
    resolver: zodResolver(linksSaveSchema),
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof linksSaveSchema>) {
    // Normalize resume and other links so they validate as URLs (prepend https:// if missing)
    const normalizedData = {
      ...data,
      resumeLink: ensureUrlHasProtocol(data.resumeLink),
      otherLink: ensureUrlHasProtocol(data.otherLink),
    } as z.infer<typeof linksSaveSchema>;

    mutate({
      ...defaultValues,
      ...normalizedData,
    });
  }

  function onGithubPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const githubUsername = getGithubUsername(pastedText);

    form.setValue("githubLink", githubUsername);
    return form.handleSubmit(onSubmit)();
  }

  function onLinkedinPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const linkedinUsername = getLinkedinUsername(pastedText);

    form.setValue("linkedInLink", linkedinUsername);
    return form.handleSubmit(onSubmit)();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="githubLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Github</FormLabel>
              <FormControl>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>github.com/</span>
                  <Input
                    onPaste={onGithubPaste}
                    {...field}
                    value={field.value ?? ""}
                    placeholder="hacker"
                    variant="primary"
                  />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="linkedInLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>LinkedIn</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-32">linkedin.com/in/</span>
                  <Input
                    onPaste={onLinkedinPaste}
                    {...field}
                    value={field.value ?? ""}
                    placeholder="hacker"
                    variant="primary"
                  />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="otherLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Personal Portfolio</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="hackerportfolio.com"
                  variant="primary"
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="resumeLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resume</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="drive.google.com/myresume"
                  variant="primary"
                />
              </FormControl>
              <FormDescription>
                Make sure that this link is public.
              </FormDescription>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
