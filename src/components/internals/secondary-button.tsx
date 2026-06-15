import React from "react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../loading-spinner";
import Arrow from "./arrow";

interface SecondaryButtonProps {
  children: React.ReactNode;
  arrow?: boolean;
  isSkeleton?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
  size?: "sm" |"lg";
  direction?: "left" | "right";

}

export default function SecondaryButton({
  children,
  arrow = false,
  isSkeleton = false,
  disabled = false,
  isLoading = false,
  size,
  direction,
  onClick,
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
        className={size=="sm" ? "py-[7px] px-[12px]":"py-[12px] px-[18px]"}
        isPending={disabled || isLoading}
        onClick={onClick}
        size={size}
      >
        {/* <Spinner isLoading={isLoading}></Spinner> */}

        {direction == "left" && 
          <Arrow 
            margin={
              size=="sm" ? "mr-[10px]":"mr-3"}
            size={size}
            direction={direction}
          />
        }

        <div>{children}</div> 

        {direction == "right" && 
          <Arrow 
            margin={
              size=="sm" ? "ml-[10px]":"ml-3"}
            size={size}
            direction={direction}
          />
        }
      </Button>
    );
}
