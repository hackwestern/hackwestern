import { Input } from "~/components/ui/input";
import PrimaryButton from "./primary-button";
import { Skeleton } from "../ui/skeleton";
import { useState } from "react";

interface TextFieldProps {
  children: string;
  submit?: boolean;
  secondary?: boolean;
  isSkeleton?: boolean;
  onSubmit?: (value: string) => Promise<void>
}
export default function TextField({
  children,
  submit = false,
  secondary = false,
  isSkeleton = false,
  onSubmit,
}: TextFieldProps) {

    const [isLoading,setIsLoading] = useState(false);
    const [value, setValue] = useState("");

    const handleSubmit = async(): Promise<void> => {
        setIsLoading(true);
        try{
            await onSubmit?.(value);
        } finally{
            setIsLoading(false);
        }
    }

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
              value = {value}
              onChange = {(e) => setValue(e.target.value)}
              placeholder={children}
              className={"border-none bg-transparent"}
              disabled={isLoading}
            />
            <PrimaryButton textField onClick={handleSubmit} isPending={isLoading} >Submit</PrimaryButton>
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
