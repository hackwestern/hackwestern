import { signOut } from "next-auth/react";
import { useRouter } from "next/router";

const Logout = () => {
  const router = useRouter();

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
