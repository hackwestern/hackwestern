import { Input } from "~/components/ui/input";
import PrimaryButton from "./buttons/primary-button";
import { Skeleton } from "../ui/skeleton";
import { useState } from "react";

interface TextFieldProps {
  children?: string;
  submit?: boolean;
  secondary?: boolean;
  isSkeleton?: boolean;
  className?: string;
  onSubmit?: (value: string) => Promise<void>;
}

export default function TextField({
  children,
  submit = false,
  secondary = false,
  isSkeleton = false,
  className,
  onSubmit,
}: TextFieldProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [value, setValue] = useState("");

  const handleSubmit = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await onSubmit?.(value);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSkeleton)
    return (
      <div className="flex items-center">
        <Skeleton className="h-10 w-max px-10 py-2 text-transparent">
          {children}
        </Skeleton>
        {submit && (
          <Skeleton className="h-10 w-max px-2 py-2 text-transparent">
            Submit
          </Skeleton>
        )}
      </div>
    );
  else
    return (
      <>
        {submit ? (
          <div className={`flex w-max`}>
            <Input
              variant="default"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={children}
              className={className}
              disabled={isLoading}
            />
            <PrimaryButton
              onClick={handleSubmit}
              disabled={isLoading}
              isLoading={isLoading}
            >
              Submit
            </PrimaryButton>
          </div>
        ) : (
          <Input variant="default" placeholder={children} className={`w-max ${className}`} />
        )}
      </>
    );
}
