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
import { useAutoSave } from "~/hooks/use-auto-save";
import { applicationStepSaveSchema } from "~/schemas/application";

export const QUESTION1 = `If your laptop suddenly gained consciousness, what do you think it would say about your working style and why? (30 to 150 words)`;
export const QUESTION2 = `What’s one piece of feedback you’ve received that stuck with you and why? (30 to 150 words)`;
export const QUESTION3 = `What’s a project you’d love to revisit and improve if you had the time, and why? (30 to 150 words)`;

export function ApplicationForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery({
    fields: ["status", "question1", "question2", "question3"],
  });

  const status = defaultValues?.status ?? "NOT_STARTED";
  const canEdit = status == "NOT_STARTED" || status == "IN_PROGRESS";

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof applicationStepSaveSchema>>({
    resolver: zodResolver(applicationStepSaveSchema),
    mode: "onBlur",
  });

  const FIELDS: Array<keyof z.infer<typeof applicationStepSaveSchema>> = [
    "question1",
    "question2",
    "question3",
  ];

  useAutoSave(form, onSubmit, defaultValues, {
    fields: FIELDS,
    debounceMs: 2000,
  });

  function onSubmit(data: z.infer<typeof applicationStepSaveSchema>) {
    mutate({
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">{QUESTION1}</FormLabel>
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
                    variant={
                      (field.value?.split(/\s+/).filter(Boolean).length ?? 0) <=
                      150
                        ? "primary"
                        : "invalid"
                    }
                    disabled={!canEdit}
                  />
                </FormControl>
                <div
                  className={`text-sm ${(field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150 ? "text-gray-500" : "text-destructive"}`}
                >
                  {field.value?.split(/\s+/).filter(Boolean).length ?? 0} / 150
                  words
                </div>
              </FormItem>
            )}
          />
        </div>
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">{QUESTION2}</FormLabel>
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
                    variant={
                      (field.value?.split(/\s+/).filter(Boolean).length ?? 0) <=
                      150
                        ? "primary"
                        : "invalid"
                    }
                    disabled={!canEdit}
                  />
                </FormControl>
                <div
                  className={`text-sm ${(field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150 ? "text-gray-500" : "text-destructive"}`}
                >
                  {field.value?.split(/\s+/).filter(Boolean).length ?? 0} / 150
                  words
                </div>
              </FormItem>
            )}
          />
        </div>
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">{QUESTION3}</FormLabel>
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
                    variant={
                      (field.value?.split(/\s+/).filter(Boolean).length ?? 0) <=
                      150
                        ? "primary"
                        : "invalid"
                    }
                    disabled={!canEdit}
                  />
                </FormControl>
                <div
                  className={`text-sm ${(field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150 ? "text-gray-500" : "text-destructive"}`}
                >
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
