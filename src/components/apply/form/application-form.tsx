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
import { text } from "stream/consumers";

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">
            If your laptop suddenly gained consciousness, what do you think it would say about your working style and why? (30 to 150 words)
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
                    variant={(field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150 ? "primary" : "invalid"}
                  />
                </FormControl>
                <div className={`text-sm ${((field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150) ? "text-gray-500" : "text-[#f76b7c]"}`}>
                  {field.value?.split(/\s+/).filter(Boolean).length ?? 0} / 150
                  words
                </div>
              </FormItem>
            )}
          />
        </div>
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">
            What’s one piece of feedback you’ve received that stuck with you and why? (30 to 150 words)
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
                    variant={(field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150 ? "primary" : "invalid"}
                  />
                </FormControl>
                <div className={`text-sm ${((field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150) ? "text-gray-500" : "text-[#f76b7c]"}`}>
                  {field.value?.split(/\s+/).filter(Boolean).length ?? 0} / 150
                  words
                </div>
              </FormItem>
            )}
          />
        </div>
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">
            What’s a project you’d love to revisit and improve if you had the time, and why? (30 to 150 words)
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
                    variant={(field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150 ? "primary" : "invalid"}
                  />
                </FormControl>
                <div className={`text-sm ${((field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150) ? "text-gray-500" : "text-[#f76b7c]"}`}>
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
