import React from "react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../loading-spinner";
import Arrow from "./arrow";

interface TertiaryButtonProps {
  children: React.ReactNode;
  arrow?: boolean;
  isSkeleton?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
  direction?: "left" | "right";

}
export default function TertiaryButton({
  children,
  arrow,
  isSkeleton,
  disabled = false,
  isLoading = false,
  onClick,
  direction,
}: TertiaryButtonProps) {
  if (isSkeleton)
    return (
      <Skeleton className="h-max w-max text-transparent">{children}</Skeleton>
    );

  return (
    <Button
      variant="tertiary"
      className="py-1 px-0"
      isPending={disabled || isLoading}
      onClick={onClick}
    >
      {direction == "left" && 
        <Arrow 
          margin="mr-[10px]"
          direction={direction}
        />
      }
      <div>{children}</div>

      {direction == "right" && 
        <Arrow 
          margin="ml-[10px]"
          direction={direction}
        />
      }
      {/* <Spinner isLoading={isLoading}></Spinner> */}
    </Button>
  );
}
