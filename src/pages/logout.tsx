import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/router";

const Logout = () => {
  const router = useRouter();
  const session = useSession();
  console.log("session:", session);

  const logout = () => {
    signOut()
      .then(() => {
        void router.push("/login");
      })
      .catch((e) => console.error(e));
  };
  return (
    <div>
      <button onClick={() => logout()}>Sign out</button>
    </div>
  );
};

export default Logout;
