import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/utils/api";
import { useAutoSave } from "~/components/hooks/use-auto-save";
import { applicationStepSaveSchema } from "~/schemas/application";

export function ApplicationForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery();
  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof applicationStepSaveSchema>>({
    resolver: zodResolver(applicationStepSaveSchema),
    mode: "onBlur",
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof applicationStepSaveSchema>) {
    mutate({
      ...defaultValues,
      ...data,
    });
  }

  const maxWords = 150;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">
            If you could have any superpower to help you during Hack Western,
            what would it be and why?
          </FormLabel>
          <FormField
            control={form.control}
            name="question1"
            render={({ field }) => (
              <FormItem className="min-w-48 flex-1">
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Type your message here"
                    variant="primary"
                  />
                </FormControl>
                <div className="text-sm text-gray-500">
                  {field.value?.split(/\s+/).filter(Boolean).length ?? 0} / 150
                  words
                </div>
              </FormItem>
            )}
          />
        </div>
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">
            If you could build your own dream destination what would it look
            like? Be as detailed and creative as you want!
          </FormLabel>
          <FormField
            control={form.control}
            name="question2"
            render={({ field }) => (
              <FormItem className="min-w-48 flex-1">
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Type your message here"
                    variant="primary"
                  />
                </FormControl>
                <div className="text-sm text-gray-500">
                  {field.value?.split(/\s+/).filter(Boolean).length ?? 0} / 150
                  words
                </div>
              </FormItem>
            )}
          />
        </div>
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">
            What project (anything you have ever worked on not just restricted
            to tech) of yours are you the most proud of and why? What did you
            learn throughout the process?
          </FormLabel>
          <FormField
            control={form.control}
            name="question3"
            render={({ field }) => (
              <FormItem className="min-w-48 flex-1">
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Type your message here"
                    variant="primary"
                  />
                </FormControl>
                <div className="text-sm text-gray-500">
                  {field.value?.split(/\s+/).filter(Boolean).length ?? 0} / 150
                  words
                </div>
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
