import React from "react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "../ui/skeleton";

interface TertiaryButtonProps {
  children: React.ReactNode;
  arrow?: boolean;
    isSkeleton?: boolean;
}
export default function TertiaryButton({
  children,
  arrow,
  isSkeleton,
}: TertiaryButtonProps) {
    if (isSkeleton) return(
        <Skeleton className="h-30 w-max text-transparent">Tertiary Button</Skeleton>
    )
  if (arrow)
    return (
      <Button variant="tertiary-arrow" className="h-max p-0">
        <div>{children}</div>
      </Button>
    );
  return (
    <Button variant="tertiary" className="h-max p-0">
      <div>{children}</div>
    </Button>
  );
}