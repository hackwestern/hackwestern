import React from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import { colors } from "~/constants/avatar";
import { api } from "~/utils/api";
import Link from "next/link";
import { signOut } from "next-auth/react";

export default function MobileCharacterIcon() {
  const { data: applicationData } = api.application.get.useQuery();
  const name = applicationData?.firstName ?? "Username";

  const bodyColor =
    colors.find((c) => c.name === applicationData?.avatarColour)?.body ?? "002";

  const selectedColor = colors.find(
    (c) => c.name === (applicationData?.avatarColour ?? "green"),
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative h-8 w-8 overflow-hidden rounded-full p-2"
          style={{
            background: `linear-gradient(135deg, ${selectedColor?.bg ?? "#F1FDE0"} 30%, ${selectedColor?.gradient ?? "#A7FB73"} 95%)`,
          }}
        >
          {/* eslint-disable @next/next/no-img-element */}
          {applicationData?.avatarColour ? (
            <img
              src={`/avatar/body/${bodyColor}.webp`}
              alt="Character"
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-sm">🎨</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="mr-4 mt-2 w-48 bg-offwhite p-4 font-figtree">
        <div className="rounded-md">
          <h3 className="mb-3 text-sm font-medium text-medium">
            {name == "Username" ? "Hello, hacker" : `Hi, ${name}`}!
          </h3>
          <div className="mb-4 h-px w-full bg-violet-200" />

          <div className="mb-3 font-figtree text-heavy">
            <Link href="/dashboard">Home</Link>
          </div>

          <div>
            <button
              className="font-figtree text-sm text-heavy underline"
              onClick={() => void signOut()}
            >
              Sign Out
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
