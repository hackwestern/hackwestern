import { Calendar, Icon, Mail } from "lucide-react";
import GithubAuthButton from "~/components/hw-design/auth/githubauth-button";
import GoogleAuthButton from "~/components/hw-design/auth/googleauth-button";
import HWButton from "~/components/hw-design/hw-button";
import HWIconButton from "~/components/hw-design/hw-icon-button";
import HWInput from "~/components/hw-design/hw-input";
function TestUI() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex w-[30%] flex-col items-center justify-center gap-3">
        <GithubAuthButton redirect="/" />
        <GoogleAuthButton redirect="/" />
        <HWButton text="Continue" variant="outline" />
        <HWButton text="Delete" variant="destructive" />
        <HWIconButton text="Mail" variant="primary" icon={Mail} />
        <HWInput
          title="Email"
          placeholder="john@doe.com"
          subtitle="Enter your email"
          variant="primary"
        />
      </div>
    </div>
  );
}

export default TestUI;
