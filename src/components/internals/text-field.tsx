import { Input } from "~/components/ui/input";
import PrimaryButton from "./primary-button";
import { Skeleton } from "../ui/skeleton";

interface TextFieldProps {
  children: string;
  submit?: boolean;
  secondary?: boolean;
  isSkeleton?: boolean;
}
export default function TextField({
  children,
  submit = false,
  secondary = false,
  isSkeleton = false,
}: TextFieldProps) {
    if (isSkeleton) return(
    <div className="flex items-center">
        <Skeleton className="h-10 px-10 py-2 w-max text-transparent">{children}</Skeleton>
        {submit && <Skeleton className="h-10 text-transparent w-max px-2 py-2">Submit</Skeleton>}
    </div>
    )
  else return (
    <>
        {submit ? (
            <div className={`flex w-max rounded-lg ${secondary ? "border bg-highlight" : "border-2 border-white bg-white/50"}`}>
            <Input
              placeholder={children}
              className={"border-none bg-transparent"}
            />
            <PrimaryButton textField>Submit</PrimaryButton>
            </div>
        ) : (
            <Input
              placeholder={children}
              className={`w-max rounded-lg border px-6 ${secondary ? "bg-highlight":"w-max border-none border-white bg-white/50"}`}            />
        )
        }
    </>
  );
}
