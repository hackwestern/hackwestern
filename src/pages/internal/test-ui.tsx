import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "~/components/ui/select";
import GithubAuthButton from "~/components/auth/githubauth-button";
import GoogleAuthButton from "~/components/auth/googleauth-button";
import { Button } from "~/components/ui/button";
import { DatePicker } from "~/components/ui/date-picker";
import { Input } from "~/components/ui/input";
import { RadioButtonItem, RadioGroup } from "~/components/ui/radio-group";
import { Textarea } from "~/components/ui/textarea";

const radioItems = [
  {
    value: "yes",
    label: "Yes",
  },
  {
    value: "no",
    label: "No",
  },
  {
    value: "maybe",
    label: "Maybe",
  },
];

const selectItems = ["Apple", "Banana", "Blueberry", "Grapes", "Pineapple"];

function TestUI() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex w-[30%] flex-col items-center justify-center gap-3">
        <GithubAuthButton redirect="/" />
        <GoogleAuthButton redirect="/" />
        <Button variant="outline">Outline</Button>
        <Button variant="primary">Primary</Button>
        <Button variant="destructive">Delete</Button>
        <Input placeholder="john@doe.com" variant="primary" />
        <Textarea placeholder="Enter answer here" variant="primary" />
        <DatePicker />
        <RadioGroup className="flex items-center gap-4">
          {radioItems.map((item) => (
            <RadioButtonItem key={item.label} {...item} />
          ))}
        </RadioGroup>
        <Select>
          <SelectTrigger className="w-96">
            <SelectValue placeholder="Select a fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {selectItems.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default TestUI;
