import React from "react";
import PrimaryButton from "./buttons/primary-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"

interface CardProps{
  title: string;
  content: React.ReactNode;
  description: string;
  footer: React.ReactNode;
  showDots?: boolean;
}
export function SmallCard({title, content, description, footer, showDots = false}: CardProps) {
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        
      </CardHeader>
      <CardContent showDots = {showDots}>
        {content}
        <CardDescription>
          {description}
        </CardDescription>
      </CardContent>
      <CardFooter className="justify-center">
        {footer}
      </CardFooter>
    </Card>
  )
}
