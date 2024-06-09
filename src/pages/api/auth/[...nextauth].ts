import NextAuth from "next-auth";
import { NextAuthOptions } from "next-auth";
import { authOptions } from "~/server/auth";
import { CredentialsProvider } from "next-auth/providers/credentials";

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      // The name to display on the sign-in form (e.g., 'Sign in with...')
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "Username" },
        password: {
          label: "Password",
          type: "password",
          placeholder: "Password",
        },
      },
      authorize: async (credentials) => {
        const { username, password } = credentials ?? {};

        // Here you should add logic to verify username and password
        // For example, you could check against a database or an external API
        if (username === "admin" && password === "password") {
          return { id: 1, name: "Admin", email: "admin@example.com" };
        } else {
          return null;
        }
      },
    }),
  ],
};

export default NextAuth(authOptions);
