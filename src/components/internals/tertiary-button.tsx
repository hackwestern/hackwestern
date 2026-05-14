import React from "react";
import { Button } from "~/components/ui/button";

export default function TertiaryButton({children}:{children:React.ReactNode}){
    return(
        <Button variant="tertiary" className="h-max p-0">
            <div>{children}</div> 
        </Button>
    )
}