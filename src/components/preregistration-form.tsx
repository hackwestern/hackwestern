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
import { Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const preregistrationFormSchema = z.object({
  email: z.string().email("Please enter a valid email."),
});

type PreregistrationFormProps = {
  className?: string;
};

export function PreregistrationForm({ className }: PreregistrationFormProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  const { mutate, isPending, reset } = api.preregistration.create.useMutation({
    onError: (error) => {
      const errorCode = error.data?.code;
      let errorMessage = "An unexpected error occurred.";

      if (errorCode === "CONFLICT") {
        errorMessage = "That email is already registered.";
      } else if (errorCode === "INTERNAL_SERVER_ERROR") {
        errorMessage = "Something went wrong. Please try again later.";
      }

      setPopupMessage(errorMessage);
      setPopupType("error");
      setShowPopup(true);
    },
    onSuccess: () => {
      setPopupMessage("Prepare for greatness.");
      setPopupType("success");
      setShowPopup(true);
      preregistrationForm.reset();
    },
    onMutate: () => {
      // Hide any existing popup when starting a new mutation
      setShowPopup(false);
    },
  });

  const preregistrationForm = useForm<
    z.infer<typeof preregistrationFormSchema>
  >({
    resolver: zodResolver(preregistrationFormSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
    },
  });

  function onSubmit(data: z.infer<typeof preregistrationFormSchema>) {
    // Reset mutation state and hide popup before new submission
    reset();
    setShowPopup(false);
    
    // Call the mutation
    mutate(data);
  }

  function onError(errors: Record<string, { message?: string }>) {
    // Show popup for validation errors
    if (errors.email) {
      setPopupMessage(errors.email.message ?? "Please enter a valid email address.");
      setPopupType("error");
      setShowPopup(true);
    }
  }

  // Auto-dismiss popup after 5 seconds
  useEffect(() => {
    if (showPopup) {
      const timer = setTimeout(() => {
        setShowPopup(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [showPopup]);



  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center space-y-4 px-12 text-primary relative min-h-[200px]",
        className,
      )}
    >
      <AnimatePresence>
        {showPopup && (
          <motion.div
            className={cn(
              "absolute top-full left-1/2 mt-4 w-[250px] transform -translate-x-1/2 flex items-center justify-center rounded-lg border px-4 py-3 shadow-lg z-[-50]",
              popupType === "success" 
                ? "border-text-muted-foreground bg-highlight text-heavy"
                : "border-red-700 bg-white text-[#b91c1c]"
            )}
            initial={{ opacity: 0, y: -120, x: "-50%" }}
            animate={{ opacity: 1, y: -90, x: "-50%" }}
            exit={{ opacity: 0, y: -120, x: "-50%" }}
            transition={{ 
              type: 'spring', 
              damping: 15, 
              stiffness: 200
            }}
          >
            <span className="flex items-center justify-between w-full">
              <span className="flex items-center">
                <span className="font-medium text-sm font-figtree ">{popupMessage}</span>
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      
      <Form {...preregistrationForm}>
        <form
          className="w-full"
          onSubmit={preregistrationForm.handleSubmit(onSubmit, onError)}
        >
          <FormField
            control={preregistrationForm.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-4">
                <div className="flex w-max space-x-2 rounded-xl border border-purple/30 bg-white pb-1 pr-1 pt-1 focus-within:ring focus-within:ring-2 focus-within:ring-ring">
                  <FormLabel className="sr-only">Email Address</FormLabel>
                  <FormControl>
                    <div className="py-0.5 flex items-center gap-1">
                      <Mail className="w-6 h-6 ml-2 text-muted-foreground" />
                      <Input
                        className="border-none bg-transparent text-heavy"
                        variant="noRing"
                        {...field}
                        placeholder="Sign up for updates"
                      />
                    </div>
                  </FormControl>
                  <div className="pt-1">
                    <Button 
                      variant="primary" 
                      className="gap-2"
                      type="submit"
                      disabled={isPending}
                    >
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={isPending ? "submitting" : "submit"}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          {isPending ? "Submitting..." : "Submit"}
                        </motion.span>
                      </AnimatePresence>
                      <Spinner isLoading={isPending} />
                    </Button>
                  </div>
                </div>
                {/* Keep FormMessage hidden since we're using the popup instead */}
                <FormMessage className="sr-only" />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
}
