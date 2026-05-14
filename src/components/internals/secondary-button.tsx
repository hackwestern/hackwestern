import React from "react";
import { Button } from "~/components/ui/button";
import RightArrow from "./right-arrow";

interface SecondaryButtonProps{
    children: React.ReactNode
    right?: boolean
}

export default function SecondaryButton({ children, right = false }:SecondaryButtonProps){
    return(
        <Button variant="secondary" className={right ? "flex justify-around px-6 py-4":"px-8 py-4"}>
            <div>{children}</div> {right && <RightArrow fill="#625679"/>}
        </Button>
    )
}