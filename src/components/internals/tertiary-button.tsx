import React from "react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../loading-spinner";

interface TertiaryButtonProps {
  children: React.ReactNode;
  arrow?: boolean;
  isSkeleton?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
}
export default function TertiaryButton({
  children,
  arrow,
  isSkeleton,
  disabled = false,
  isLoading = false,
  onClick,
}: TertiaryButtonProps) {
  if (isSkeleton)
    return (
      <Skeleton className="h-max w-max text-transparent">
        {children}
      </Skeleton>
    );

  return (
    <Button
      variant={arrow ? "tertiary-arrow" : "tertiary"}
      className="h-max p-0"
      isPending={disabled || isLoading}
      onClick={onClick}
    >
      <div>{children}</div>
      <Spinner isLoading={isLoading}></Spinner>
    </Button>
  );
}
