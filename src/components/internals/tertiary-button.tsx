import React from "react";
import { Button } from "~/components/ui/button";

interface TertiaryButtonProps{
    children: React.ReactNode
    arrow?: boolean
}
export default function TertiaryButton({
  children, arrow
}: 
  TertiaryButtonProps
) {
    if (arrow) return(
        <Button variant="tertiary-arrow" className="h-max p-0">
      <div>{children}</div>
    </Button>
    )
  return (
    <Button variant="tertiary" className="h-max p-0">
      <div>{children}</div>
    </Button>
  );
}
