import GithubAuthButton from "~/components/hw-design/auth/githubauth-button";
import GoogleAuthButton from "~/components/hw-design/auth/googleauth-button";
import HWButton from "~/components/hw-design/hw-button";
function TestUI() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex w-[30%] flex-col items-center justify-center gap-3">
        <GithubAuthButton redirect="/" />
        <GoogleAuthButton redirect="/" />
        <HWButton variant="" />
      </div>
    </div>
  );
}

export default TestUI;
