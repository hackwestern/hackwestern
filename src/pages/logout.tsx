import { signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { authRedirectHacker } from "~/utils/redirect";
import { api } from "~/utils/api";

const Logout = () => {
  const router = useRouter();

  const { data: application } = api.application.get.useQuery({
    fields: ["firstName"],
  });
  const name = application?.firstName;

  const logout = () => {
    signOut()
      .then(() => {
        void router.push("/login");
      })
      .catch((e) => console.error(e));
  };
  return (
    <div className="font-figtree font-semibold text-heavy">
      Hi there{name ? `, ${name}` : ""}! |{" "}
      <button className="hover:underline" onClick={() => logout()}>
        Sign Out
      </button>
    </div>
  );
};

export default Logout;
export const getServerSideProps = authRedirectHacker;
