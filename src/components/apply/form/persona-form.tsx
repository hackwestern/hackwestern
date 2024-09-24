import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "~/components/ui/form";
import { api } from "~/utils/api";
import { useAutoSave } from "~/components/hooks/use-auto-save";
import { personaSaveSchema } from "~/schemas/application";
import AvatarRadio from "../avatar-radio";

type AvatarType = "Wildlife Wanderer" | "City Cruiser" | "Foodie Fanatic" | "Beach Bum";

export function PersonaForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery();
  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof personaSaveSchema>>({
    resolver: zodResolver(personaSaveSchema),
    defaultValues,
    mode: "onBlur",
  });

  useAutoSave(form, onSubmit);

  function onSubmit(data: z.infer<typeof personaSaveSchema>) {
    mutate({
      ...defaultValues,
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <div className="flex w-full flex-wrap gap-2">
          <FormField
            control={form.control}
            name="avatar"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <AvatarRadio
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}