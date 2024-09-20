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
  const { data: defaultValues } = api.application.get.useQuery();
  const { mutate } = api.application.save.useMutation();

  const form = useForm<z.infer<typeof linksSaveSchema>>({
    resolver: zodResolver(linksSaveSchema),
    defaultValues,
    mode: "onBlur",
  });

  useAutoSave(form, onSubmit);

  function onSubmit(data: z.infer<typeof linksSaveSchema>) {
    mutate({
      ...defaultValues,
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        onChange={() => console.log(form.getValues())}
        className="space-y-2"
      >
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
