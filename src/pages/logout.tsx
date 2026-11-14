import { signOut } from "next-auth/react";
import { useEffect } from "react";

// Visiting /logout signs you out and sends you to the homepage.
const Logout = () => {
  useEffect(() => {
    void signOut({ callbackUrl: "/" });
  }, []);

  return null;
};

export default Logout;
