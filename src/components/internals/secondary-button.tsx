import React from "react";
import { Button } from "~/components/ui/button";
import RightArrow from "./right-arrow";

interface SecondaryButtonProps {
  children: React.ReactNode;
  arrow?: boolean;
}

export default function SecondaryButton({
  children,
  arrow = false,
}: SecondaryButtonProps) {
  return (
    <Button
      variant="secondary"
      className={arrow ? "flex justify-around px-6 py-4" : "px-8 py-4"}
    >
      <div>{children}</div> {arrow && <RightArrow fill="#625679" />}
    </Button>
  );
}
