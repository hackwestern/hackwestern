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
    if (isSkeleton) return(
        <Skeleton className="h-30 w-max text-transparent">Tertiary Button</Skeleton>
    )

    return (
      <Button variant={arrow ? "tertiary-arrow":"tertiary"} className="h-max p-0" isPending = {disabled} onClick = {onClick}>
        <Spinner isLoading={isLoading}></Spinner> 
        <div>{children}</div>
      </Button>
    );
}
