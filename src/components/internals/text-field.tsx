import { Input } from "~/components/ui/input";
import PrimaryButton from "./primary-button";

interface TextFieldProps{
    children: string
    submit?: boolean
    secondary?: boolean

}
export default function TextField({children, submit = false, secondary = false}: TextFieldProps){
    return(
        <>
        {submit ? (
            <div className={`flex w-max rounded-lg ${secondary ? "border bg-highlight" : "border-2 border-white bg-white/50}"}`}>
            <Input
              placeholder={children}
              className={"border-none bg-transparent"}
            />
            <PrimaryButton textField>Submit</PrimaryButton>
            </div>
        ) : (
            <Input
              placeholder={children}
              className={`w-max rounded-lg border px-6 ${secondary ? "bg-highlight":"border-none border-white bg-white/50"}`}            />
        )
        }
        </>
    )
    
}