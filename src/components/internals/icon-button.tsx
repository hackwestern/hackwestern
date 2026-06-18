import React from "react";
import { Button } from "~/components/ui/button";
import Arrow from "./arrow";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../loading-spinner";
import { ButtonProps } from "./buttonProps";

export default function IconButton({
  children,
  disabled = false,
  onClick,
  className,
}: ButtonProps) {
    return (
      <Button
        variant="icon"
        onClick={onClick}
        size="icon"
        className={className}
        disabled={disabled}
      >

        <div>{children}</div>

      </Button>
    );
}
