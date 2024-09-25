import { Calendar, Icon, Mail } from "lucide-react";
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
      </div>
    </div>
  );
}

export default TestUI;
