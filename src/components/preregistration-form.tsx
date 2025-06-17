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
    api.preregistration.create.useMutation({
      onError: (error) => {
        const errorCode = error.data?.code;

        if (errorCode == "CONFLICT"){
          preregistrationForm.setError("email", {
            message: "That email is already registered.",
          });
        } else if (errorCode === "INTERNAL_SERVER_ERROR") {
          preregistrationForm.setError("email", {
            message: "Something went wrong. Please try again later.",
          });
        } else {
          preregistrationForm.setError("email", {
            message: "An unexpected error occurred.",
          });
        }
      }
    });

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
              <FormItem className="space-y-4">
                <div className="flex w-max space-x-2 rounded-xl focus-within:ring focus-within:ring-2 focus-within:ring-ring border border-white bg-white bg-opacity-50 pr-1 pt-1 pb-1">
                  <FormLabel className="sr-only">Email Address</FormLabel>
                  <FormControl>
                    <div className="py-0.5">
                      <Input
                        className="border-none bg-transparent text-heavy"
                        variant="noRing"
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
                <FormMessage className="text-[#AC2323] font-jetbrainsmono text-center" />
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
