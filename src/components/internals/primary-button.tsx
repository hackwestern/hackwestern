import React from "react";
import { Button } from "~/components/ui/button";
import RightArrow from "./right-arrow";
import { Skeleton } from "../ui/skeleton";

interface PrimaryButtonProps {
  children: React.ReactNode;
  arrow?: boolean;
  textField?: boolean;
  isSkeleton?: boolean;
  isPending?: boolean;
  onClick?: () => void;
}

export default function PrimaryButton({
  children,
  arrow = false,
  textField = false,
  isSkeleton = false,
  isPending = false,
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
        className={
          !textField
            ? arrow
              ? "flex justify-around px-6 py-4"
              : "px-8 py-4"
            : ""
        }
        isPending={isPending}
        onClick={onClick}
      >
        <div>{children}</div> {arrow && <RightArrow />}
      </Button>
    );
}
