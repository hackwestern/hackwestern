import NextAuth from "next-auth";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authRouter } from "~/server/api/routers/auth";
import { appRouter } from "~/server/api/root";

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
      async authorize(credentials, req) {
        // Add logic here to look up the user from the credentials supplied
        if (!credentials) {
          return null;
        }
        const { username: email, password } = credentials;

        try {
          const result = await authRouter.login({ email, password });
          if (result.success) {
            return result.user;
          } else {
            return null;
          }
        } catch (error) {
          console.error("Login error", error);
          return null;
        }
      },
    }),
  ],
};

export default NextAuth(authOptions);
