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
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center px-12 text-primary",
        className,
      )}
    >
      <a
        id="mlh-trust-badge"
        className="fixed right-12 top-0 z-50 block w-full min-w-5 max-w-16"
        href="https://mlh.io/na?utm_source=na-hackathon&utm_medium=TrustBadge&utm_campaign=2025-season&utm_content=white"
        target="_blank"
      >
        <img
          src="https://s3.amazonaws.com/logged-assets/trust-badge/2025/mlh-trust-badge-2025-white.svg"
          alt="Major League Hacking 2025 Hackathon Season"
          style={{ width: "100%" }}
        />
      </a>
      <h4 className="py-3 text-lg font-medium text-[#F6F2FD]">
        {isSuccess
          ? "Thanks! You'll hear from us soon 🛩️"
          : "Get notified when applications drop:"}
      </h4>
      {!isSuccess && (
        <Form {...preregistrationForm}>
          <form
            className="w-full"
            onSubmit={preregistrationForm.handleSubmit(onSubmit)}
          >
            <FormField
              control={preregistrationForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <div className="flex w-full flex-row gap-2 rounded-md bg-white p-0.5">
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
