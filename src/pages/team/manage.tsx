import Head from "next/head";
import TertiaryButton from "~/components/internals/tertiary-button";
import { TeamNav } from "./teamnav";

const MOCK_MEMBERS = [
  { id: "u1", name: "Priya Shah", email: "priya@example.com" },
  { id: "u2", name: "Sam Okafor", email: "sam@example.com" },
  { id: "u3", name: "Jae Kim", email: "jae@example.com" },
];

export default function CurrentTeamPage() {
  return (
    <>
      <Head>
        <title>Your Team — Hack Western 13</title>
      </Head>
      <main className="min-h-screen bg-offwhite px-4 py-12">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <TeamNav />

          <h1 className="h1 text-heavy">Your Team</h1>

          <div className="flex flex-col gap-2">
            {MOCK_MEMBERS.map((member) => (
              <div
                key={member.id}
                className="rounded-lg border border-gray-1 bg-white-0 px-4 py-3"
              >
                <p className="p2 text-heavy">{member.name}</p>
                <p className="p3 text-light">{member.email}</p>
              </div>
            ))}
          </div>

          <TertiaryButton>Delete Team</TertiaryButton>
        </div>
      </main>
    </>
  );
}