import Head from "next/head";
import { useRouter } from "next/router";
import { type FormEvent, useState } from "react";
import GithubAuthButton from "~/components/auth/githubauth-button";
import GoogleAuthButton from "~/components/auth/googleauth-button";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useToast } from "~/components/hooks/use-toast";
import { api } from "~/utils/api";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { hackerLoginRedirect } from "~/utils/redirect";
import DiscordAuthButton from "~/components/auth/discordauth-button";
import { ApplyNavbar } from "~/components/apply/navbar";
import { Passport } from "~/components/apply/passport";
import logout from "./logout";
import {
  CanvasComponent,
  canvasHeight,
  canvasWidth,
} from "~/components/canvas/canvas";
import { Avatar } from "~/components/apply/avatar";

export default function Register() {
  type ApplicationStatusType =
    | "IN_PROGRESS"
    | "PENDING_REVIEW"
    | "IN_REVIEW"
    | "ACCEPTED"
    | "REJECTED"
    | "WAITLISTED"
    | "DECLINED";

  const application = { firstName: "jasmine" };
  return (
    <>
      <Head>
        <title>Hack Western</title>
        <meta
          name="description"
          content="Hack Western: One of Canada's largest annual student-run hackathons based out of Western University in London, Ontario."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="absolute inset-0 h-full w-full bg-hw-radial-gradient opacity-100" />
      <div className="absolute inset-0 h-full w-full bg-[radial-gradient(#776780_1.5px,transparent_1px)] opacity-40 [background-size:20px_20px]" />
      <main className="flex h-svh max-h-svh flex-col items-center bg-primary-50">
        <ApplyNavbar />
        <div className="relative flex w-full flex-grow flex-col items-center md:flex-row">
          {/* Left Panel */}
          <div
            id="left-panel"
            className="z-10 flex w-[20%] flex-grow flex-col items-center justify-center gap-4 bg-primary-100 p-9 pt-12 text-center md:h-full lg:max-w-xl"
          />
          <div
            id="right-panel"
            className="flex h-full w-full flex-col items-center justify-center"
          >
            <div className="z-10 flex w-[100%] flex-col items-center justify-center ">
              <Avatar />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps = hackerLoginRedirect;
