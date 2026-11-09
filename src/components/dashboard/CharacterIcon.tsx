import React from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import { getHorse } from "~/constants/realms";
import { api } from "~/utils/api";
import Link from "next/link";
import { signOut } from "next-auth/react";
import Image from "next/image";

const FALLBACK_HORSE_ASSET = "/apply/realm/safari-1.png";

export default function CharacterIcon() {
  const { data: applicationData } = api.application.get.useQuery({
    fields: ["firstName", "horseId"],
  });
  const name = applicationData?.firstName ?? "Username";

  const horseAsset =
    getHorse(applicationData?.horseId)?.asset ?? FALLBACK_HORSE_ASSET;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative h-8 w-8 overflow-hidden rounded-full bg-white p-1 transition-all hover:ring-2 hover:ring-heavy/70 lg:h-10 lg:w-10"
          aria-label="Account menu"
        >
          <Image
            src={horseAsset}
            alt="Your horse companion"
            width={32}
            height={32}
            className="h-full w-full object-contain"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="mr-4 mt-2 w-48 bg-offwhite p-4 font-secondary">
        <div className="rounded-md">
          <h3 className="mb-3 text-sm font-medium text-gray-6">
            {name == "Username" ? "Hello, hacker" : `Hi, ${name}`}!
          </h3>
          <div className="mb-4 h-px w-full bg-gray-2" />

          <div className="mb-3 font-secondary text-heavy">
            <Link href="/dashboard">Home</Link>
          </div>

          <div>
            <button
              className="font-secondary text-sm text-heavy underline"
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
