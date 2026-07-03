import PrimaryButton from "./buttons/primary-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"

export function SmallCard() {
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Small Card</CardTitle>
        
      </CardHeader>
      <CardContent showDots>
        <p>
          The card component supports a size prop that can be set to
          &quot;sm&quot; for a more compact appearance.
        </p>
        <CardDescription>
          This card uses the small size variant.
        </CardDescription>
      </CardContent>
      <CardFooter className="justify-center">
        <PrimaryButton size="sm" className="w-full">
          Action
        </PrimaryButton>
      </CardFooter>
    </Card>
  )
}
