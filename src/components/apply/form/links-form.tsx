import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useAutoSave } from "~/components/hooks/use-auto-save";
import { linksSaveSchema } from "~/schemas/application";

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
    defaultValues,
    mode: "onBlur",
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof linksSaveSchema>) {
    mutate({
      ...defaultValues,
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <FormField
          control={form.control}
          name="githubLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Github</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="github.com/hacker"
                  variant="primary"
                />
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
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="linkedin.com/in/hacker"
                  variant="primary"
                />
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
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
