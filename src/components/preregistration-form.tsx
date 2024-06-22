import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { api } from "~/utils/api";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const preregistrationFormSchema = z.object({
  email: z.string().email("Please enter a valid email."),
});

type PreregistrationFormProps = {
  className?: string;
};

export function PreregistrationForm({ className }: PreregistrationFormProps) {
  const { mutate, isSuccess } = api.preregistration.create.useMutation();

  const preregistrationForm = useForm<
    z.infer<typeof preregistrationFormSchema>
  >({
    resolver: zodResolver(preregistrationFormSchema),
  });

  function onSubmit(data: z.infer<typeof preregistrationFormSchema>) {
    mutate(data);
  }

  return (
    <div className="flex flex-col items-center justify-center">
      {isSuccess && (
        <h4 className="text-[#F6F2FD]">
          Thanks! You&apos;ll hear from us soon 🛩️
        </h4>
      )}
      {!isSuccess && (
        <Form {...preregistrationForm}>
          <h4 className="py-3 text-lg font-medium text-[#F6F2FD]">
            Get notified when applications drop:
          </h4>
          <form onSubmit={preregistrationForm.handleSubmit(onSubmit)}>
            <FormField
              control={preregistrationForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <div
                    className={cn(
                      "flex w-full flex-row gap-2 rounded-md bg-white p-0.5",
                      className,
                    )}
                  >
                    <FormLabel className="sr-only">Email Address</FormLabel>
                    <FormControl>
                      <Input
                        className="h-8 border-0 px-1 py-0"
                        {...field}
                        placeholder="Email Address"
                      />
                    </FormControl>
                    <Button
                      size="sm"
                      type="submit"
                      className="bg-gradient-to-r from-[#A87DF1] to-[#5E28B8] px-10 py-0"
                    >
                      Submit
                    </Button>
                  </div>
                  <FormMessage className="text-[#5E28B8]" />
                </FormItem>
              )}
            />
          </form>
        </Form>
      )}
    </div>
  );
}
