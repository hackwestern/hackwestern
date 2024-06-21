import { useState } from "react";
import { Input } from "~/components/ui/input";
import { api } from "~/utils/api";
// import { OrganizerRedirect } from "~/lib/authRedirect";
import { authRedirect } from "../../utils/redirect";

const TestPasswordReset = () => {
  const reset = api.auth.reset.useMutation();
  const [email, setEmail] = useState("");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#160524]">
      <Input
        className="w-96"
        onChange={(e) => setEmail(e.target.value)}
        value={email}
        placeholder="email"
      />
      <div
        onClick={() => reset.mutate({ email })}
        className="m-2 cursor-pointer rounded bg-white p-2"
      >
        Reset Password
      </div>
    </main>
  );
};

export default TestPasswordReset;
export const getServerSideProps = authRedirect;
