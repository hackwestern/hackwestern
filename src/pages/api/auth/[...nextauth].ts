import NextAuth from "next-auth";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";

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
      async authorize(credentials, _req) {
        // Add logic here to look up the user from the credentials supplied
        if (!credentials) {
          return null;
        }
        const { username: email, password } = credentials;

        try {
          const result = await login(email, password);
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

async function login(email: string, password: string) {
  try {
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    if (!user.password) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Password not set",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid password",
      });
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  } catch (error) {
    throw error instanceof TRPCError
      ? error
      : new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to login" + JSON.stringify(error),
        });
  }
}

export default NextAuth(authOptions);
