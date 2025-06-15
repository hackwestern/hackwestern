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
import { Spinner } from "~/components/loading-spinner";

const preregistrationFormSchema = z.object({
  email: z.string().email("Please enter a valid email."),
});

type PreregistrationFormProps = {
  className?: string;
};

export function PreregistrationForm({ className }: PreregistrationFormProps) {
  const { mutate, isSuccess, isPending } =
    api.preregistration.create.useMutation();

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
        "flex w-full flex-col items-center justify-center px-12 text-primary space-y-4",
        className,
      )}
    >
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
                <div className="flex w-max space-x-2 rounded-xl border border-white bg-white bg-opacity-50 pr-1 pt-1 pb-1">
                  <FormLabel className="sr-only">Email Address</FormLabel>
                  <FormControl>
                    <div className="py-0.5">
                      <Input
                        className="border-none bg-transparent text-heavy"
                        {...field}
                        placeholder="jimmy@hacker.ca"
                      />
                    </div>
                  </FormControl>
                  <div className="pt-1">
                    <Button variant="primary" className="gap-2">
                      <span>Submit</span>
                      <Spinner isLoading={isPending} />
                    </Button>
                  </div>
                </div>
                <FormMessage className="text-[#5E28B8]" />
              </FormItem>
            )}
          />
        </form>
      </Form>
      <p className="font-figtree font-medium text-heavy">
        {isSuccess ? "Prepare for greatness." : ""}
      </p>
    </div>
  );
}
