import React from "react";
import { Button } from "~/components/ui/button";
import RightArrow from "./right-arrow";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../loading-spinner";

interface PrimaryButtonProps {
  children: React.ReactNode;
  arrow?: boolean;
  textField?: boolean;
  isSkeleton?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
  size?: "sm" |"lg";
}

export default function PrimaryButton({
  children,
  arrow = false,
  textField = false,
  isSkeleton = false,
  disabled = false,
  isLoading = false,
  size,
  onClick,
}: PrimaryButtonProps) {
  if (isSkeleton)
    return (
      <Skeleton className="h-10 w-max shrink-0 px-4 py-2 text-transparent">
        {children}
      </Skeleton>
    );
  else
    return (
      <Button
        variant="primary"
        isPending={disabled || isLoading}
        onClick={onClick}
        size={size}
      >
        {/* <Spinner isLoading={isLoading}></Spinner> */}
        <div>{children}</div> {arrow && <RightArrow />}
      </Button>
    );
}
