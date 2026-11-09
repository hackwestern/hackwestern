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
import { text } from "stream/consumers";
import { useCanEditApplication } from "~/hooks/use-can-edit-application";

export const QUESTION1 = `An AI assistant spends a week observing your habits, then writes an honest review of you. What does it say? (30 to 150 words)`;
export const QUESTION2 = ` What’s one technical skill or tool you taught yourself recently? What did you make or try with it? (30 to 150 words)`;
export const QUESTION3 = `What’s your favourite thing you’ve ever built? Why did you start, and what did you enjoy most about making it? It can be technical or nontechnical, finished or unfinished. Include a link if you have one. (30 to 150 words)`;

export function ApplicationForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery();

  const status = defaultValues?.status ?? "NOT_STARTED";
  const canEdit = useCanEditApplication(status);

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
                  className={`text-sm ${(field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150 ? "font-figtree text-light" : "text-destructive"}`}
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
                  className={`text-sm ${(field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150 ? "font-figtree text-light" : "text-destructive"}`}
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
                  className={`text-sm ${(field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150 ? "font-figtree text-light" : "text-destructive"}`}
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
