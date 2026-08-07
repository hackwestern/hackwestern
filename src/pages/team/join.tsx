import Head from "next/head";
import PrimaryButton from "~/components/internals/primary-button";
import SecondaryButton from "~/components/internals/secondary-button";
import TertiaryButton from "~/components/internals/tertiary-button";
import { Input } from "~/components/ui/input";
import { TeamNav } from "./teamnav";
import TextField from "~/components/internals/text-field";
import { useState } from "react";
import Link from "next/link";
import { Router } from "next/router";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";


// Swap for the real "does the user have a team" check once this is wired
// to the backend. Toggle button below is just for previewing both states.
const MOCK_CURRENT_TEAM = { id: "a1b2c3", name: "Byte Me", memberCount: 3 };

export default function JoinTeamPage() {
  const [isInTeam, setIsInTeam] = useState(true);

  const [showWindow, setShowWindow] = useState(false);

  const handleLeave = () => {
    console.log("leaving team")
    setIsInTeam(false)
  };

  return (
    <>
      <Head>
        <title>Team — Hack Western 13</title>
      </Head>
      <main className="min-h-screen bg-offwhite px-4 py-12">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <TeamNav />

          <div className="flex items-center justify-between">
            <h1 className="h1 text-heavy">Team</h1>
            {/* Preview toggle only — remove once wired to real team state. */}
            <TertiaryButton onClick={() => setIsInTeam((v) => !v)}>
              Preview: {isInTeam ? "In a team" : "No team"}
            </TertiaryButton>
          </div>

          {isInTeam ? (
            <div className="flex flex-col gap-4">
              <h3 className="h3">Current Team</h3>
              <Link href="/team/manage">
              <div className="rounded-lg border border-gray-1 bg-white-0 px-4 py-3 hover:bg-blue-1">
                <p className="p2 text-heavy">{MOCK_CURRENT_TEAM.name}</p>
                <p className="p3 text-light">
                  {MOCK_CURRENT_TEAM.memberCount}/4 members · Code:{" "}
                  <span className="font-mono">{MOCK_CURRENT_TEAM.id}</span>
                </p>
              </div>
              </Link>

              <div className="flex gap-3">
                <SecondaryButton full onClick={() => setShowWindow(true)}>Leave Team</SecondaryButton>
              </div>

              {showWindow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <Card className="h-200%">
                  <CardHeader>
                    <CardTitle>Leave Team</CardTitle>
                  </CardHeader>
                  <CardContent>
                    Are you sure you want to leave this team?
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Button onClick={() => setShowWindow(false)} className="bg-grey-1">
                      Cancel
                    </Button>

                    <Button onClick={() => handleLeave()}>
                      Leave
                    </Button>
                  </CardFooter>
                </Card>
              </div>
    )}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <h3 className="h3">Find a Team</h3>
              <div className="flex items-center">
              <Input placeholder="Search teams by name..." className="w-full" />
              <PrimaryButton>Join</PrimaryButton>
              </div>
              <div className="flex gap-3">
                
                <SecondaryButton full>Create a Team</SecondaryButton>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}