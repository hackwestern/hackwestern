import React from "react";
import { Button } from "~/components/ui/button";
import RightArrow from "./right-arrow";

interface PrimaryButtonProps {
  children: React.ReactNode;
  right?: boolean;
  textField?: boolean;
}

export default function PrimaryButton({
  children,
  right = false,
  textField = false,
}: PrimaryButtonProps) {
  return (
    <Button
      variant="primary"
      className={
        !textField
          ? right
            ? "flex justify-around px-6 py-4"
            : "px-8 py-4"
          : ""
      }
    >
      <div>{children}</div> {right && <RightArrow />}
    </Button>
  );
}
