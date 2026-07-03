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
import PrimaryButton from "~/components/internals/primary-button";
import { Window } from "~/components/internals/window";
import { cn } from "~/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

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
      setPopupMessage("See you soon!");
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
      setPopupMessage(
        errors.email.message ?? "Please enter a valid email address.",
      );
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
    <div className={cn("relative flex flex-col items-start gap-[11px]", className)}>
      <Form {...preregistrationForm}>
        <form
          onSubmit={preregistrationForm.handleSubmit(onSubmit, onError)}
        >
          <FormField
            control={preregistrationForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Email Address</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-[14px]">
                    <Input
                      className="h-[35px] w-[223px]"
                      variant="default"
                      placeholder="Sign up for updates"
                      type="email"
                      {...field}
                    />
                    <PrimaryButton
                      size="sm"
                      direction="right"
                      isLoading={isPending}
                      className="h-[35px]"
                    >
                      Submit
                    </PrimaryButton>
                  </div>
                </FormControl>
                <FormMessage className="sr-only" />
              </FormItem>
            )}
          />
        </form>
      </Form>
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {showPopup && (
            <motion.div
              className="fixed left-1/2 top-6 z-50"
              style={{ x: "-50%" }}
              initial={{ opacity: 0, y: "-100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "-100%" }}
              transition={{ type: "spring", damping: 22, stiffness: 320 }}
            >
              <Window
                title={popupType === "success" ? "hackwestern.exe" : "error.exe"}
                width={300}
                autoHeight
                disableExpand
                onMinimizedChange={(min) => { if (min) setShowPopup(false); }}
              >
                <p className="px-4 text-center font-figtree text-sm font-medium text-heavy">
                  {popupMessage}
                </p>
              </Window>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
