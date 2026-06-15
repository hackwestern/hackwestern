import React from "react";
import { Button } from "~/components/ui/button";
import Arrow from "./arrow";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../loading-spinner";
import Image from "next/image";
interface PrimaryButtonProps {
  children: React.ReactNode;
  arrow?: boolean;
  textField?: boolean;
  isSkeleton?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
  size?: "sm" |"lg";
  direction?: "left" | "right";
}

export default function PrimaryButton({
  children,
  arrow = false,
  textField = false,
  isSkeleton = false,
  disabled = false,
  isLoading = false,
  size,
  direction,
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
        className={size=="sm" ? "pt-[7px] pb-[10px] px-[16px]":"pt-[12px] pb-[15px] px-[18px]"}
      >
        {/* <Spinner isLoading={isLoading}></Spinner> */}
        
        
        {direction == "left" && 
          <Arrow 
            fill = "#111111"
            margin={
              size=="sm" ? "mr-2":"mr-4"}
            size={size}
            direction={direction}
          />
          }
        

        <div>{children}</div>
        
        {direction == "right" && 
          <Arrow 
            fill = "#111111"
            margin={
              size=="sm" ? "ml-2":"ml-4"}
            size={size}
            direction={direction}
          />
          }
        
        
        
      </Button>
    );
}
