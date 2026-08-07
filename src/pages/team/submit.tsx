import { useState } from "react";
import Head from "next/head";
import PrimaryButton from "~/components/internals/primary-button";
import { Input } from "~/components/ui/input";
import { TeamNav } from "./teamnav";

//add countdown?

const MOCK_TRACK_OPTIONS = ["Beginner", "Sustainability", "Health Tech", "Open Innovation"];
const MOCK_MEMBERS = [
  { id: "u1", name: "Priya Shah" },
  { id: "u2", name: "Sam Okafor" },
  { id: "u3", name: "Jae Kim" },
];

export default function SubmitPage() {
  const [tracks, setTracks] = useState<string[]>([]);

  const toggleTrack = (track: string) => {
    setTracks((prev) =>
      prev.includes(track) ? prev.filter((t) => t !== track) : [...prev, track],
    );
  };

  return (
    <>
      <Head>
        <title>Submit Project — Hack Western 13</title>
      </Head>
      <main className="min-h-screen bg-offwhite px-4 py-12">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <TeamNav />

          <h1 className="h1 text-heavy">Submit Project</h1>

          <label className="flex flex-col gap-1">
            <span className="p3 text-medium">DevPost link</span>
            <Input placeholder="https://devpost.com/software/..." />
          </label>

          <label className="flex flex-col gap-1">
            <span className="p3 text-medium">Repository link</span>
            <Input placeholder="https://github.com/your-team/project" />
          </label>

          <div className="flex flex-col gap-2">
            <span className="p3 text-medium">Tracks</span>
            <div className="flex flex-wrap gap-2">
              {MOCK_TRACK_OPTIONS.map((track) => {
                const selected = tracks.includes(track);
                return (
                  <button
                    key={track}
                    type="button"
                    onClick={() => toggleTrack(track)}
                    className={
                      "p3 rounded-full border px-3 py-1.5 " +
                      (selected
                        ? "border-blue-5 bg-blue-1 text-heavy"
                        : "border-gray-1 bg-white-0 text-medium")
                    }
                  >
                    {track}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <span className="p3 text-medium">Team Members</span>
            {MOCK_MEMBERS.map((member) => (
              <div key={member.id} className="flex flex-col gap-2">
                <p className="p2 text-heavy">{member.name}</p>
                <div className="flex gap-3">
                  <Input placeholder="GitHub username" className="flex-1" />
                  <Input placeholder="LinkedIn URL" className="flex-1" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <PrimaryButton full>Save Submission</PrimaryButton>
            <PrimaryButton full>Submit Project</PrimaryButton>
          </div>
        </div>
      </main>
    </>
  );
}