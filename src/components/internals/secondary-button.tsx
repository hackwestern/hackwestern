import React from "react";
import { Button } from "~/components/ui/button";
import RightArrow from "./right-arrow";
import { Skeleton } from "../ui/skeleton";

interface SecondaryButtonProps {
  children: React.ReactNode;
  arrow?: boolean;
  isSkeleton?: boolean;
}

export default function SecondaryButton({
  children,
  arrow = false,
  isSkeleton = false,
}: SecondaryButtonProps) {
  if (isSkeleton)
    return (
      <Skeleton className="h-10 w-max shrink-0 px-4 py-2 text-transparent">
        {children}
      </Skeleton>
    );
  else
    return (
      <Button
        variant="secondary"
        className={arrow ? "flex justify-around px-6 py-4" : "px-8 py-4"}
      >
        <div>{children}</div> {arrow && <RightArrow fill="#625679" />}
      </Button>
    );
}
