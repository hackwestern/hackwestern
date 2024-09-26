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
import {
  applicationSaveSchema,
  applicationSubmitSchema,
  basicsSaveSchema,
} from "~/schemas/application";

export function ApplicationForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery();
  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof applicationSubmitSchema>>({
    resolver: zodResolver(basicsSaveSchema),
    mode: "onBlur",
  });

  useAutoSave(form, onSubmit);

  function onSubmit(data: z.infer<typeof applicationSubmitSchema>) {
    mutate({
      ...defaultValues,
      ...data,
    });
  }

  const maxChars = 150;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">
            Tell us why you think you will win Hack Western 11.
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
                    maxLength={maxChars}
                    placeholder="Type your message here"
                    variant="primary"
                    onChange={(e) => {
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <div className="text-sm text-gray-500">
                  {maxChars - (field.value?.length ?? 0)} characters remaining
                </div>
              </FormItem>
            )}
          />
        </div>

        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">
            Tell us why you think you will win Hack Western 11.
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
                    maxLength={maxChars}
                    placeholder="Type your message here"
                    variant="primary"
                    onChange={(e) => {
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <div className="text-sm text-gray-500">
                  {maxChars - (field.value?.length ?? 0)} characters remaining
                </div>
              </FormItem>
            )}
          />
        </div>

        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">
            Tell us why you think you will win Hack Western 11.
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
                    maxLength={maxChars}
                    placeholder="Type your message here"
                    variant="primary"
                    onChange={(e) => {
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <div className="text-sm text-gray-500">
                  {maxChars - (field.value?.length ?? 0)} characters remaining
                </div>
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
