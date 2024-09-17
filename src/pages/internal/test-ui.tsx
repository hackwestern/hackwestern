import { Calendar, Icon, Mail } from "lucide-react";
import GithubAuthButton from "~/components/auth/githubauth-button";
import GoogleAuthButton from "~/components/auth/googleauth-button";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

function TestUI() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex w-[30%] flex-col items-center justify-center gap-3">
        <GithubAuthButton redirect="/" />
        <GoogleAuthButton redirect="/" />
        <Button variant="primary"> Continue</Button>
        <Button variant="outline"> Continue</Button>
        <Button variant="destructive">Delete</Button>
        <Input placeholder="john@doe.com" variant="primary" />
        <Textarea placeholder="Enter answer here" variant="primary" />
      </div>
    </div>
  );
}

export default TestUI;
