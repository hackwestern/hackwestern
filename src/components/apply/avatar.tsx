import React from "react";
import Image from "next/image";

type AvatarType =
  | "Wildlife Wanderer"
  | "City Cruiser"
  | "Foodie Fanatic"
  | "Beach Bum"
  | null
  | undefined;

type AvatarProps = {
  avatar: AvatarType;
  selection: boolean;
};

function getAvatarImage(avatar: AvatarType) {
  switch (avatar) {
    case "Wildlife Wanderer":
      return "/images/wildlifewanderer.svg";
    case "City Cruiser":
      return "/images/citycruiser.svg";
    case "Foodie Fanatic":
      return "/images/foodiefanatic.svg";
    case "Beach Bum":
      return "/images/beachbum.svg";
    default:
      return "";
  }
}

const Avatar = ({ avatar, selection }: AvatarProps) => {
  return (
    <div>
    {selection && (
      <>
        <div className="relative h-[170px] w-[170px]">
          <div className="absolute left-2 top-1">
            <p className="text-sm text-slate-500">{avatar}</p>
          </div>
          <div className="flex flex-col items-center justify-end">
            <Image
              src={getAvatarImage(avatar)}
              alt="Avatar"
              fill={true}
            />
          </div>
        </div>
      </>
    )}
    {!selection && avatar && (
      <>
        <div className="relative flex aspect-square w-2/3 flex-col items-center justify-end rounded-lg bg-primary-200 pr-[18.896px]">
          <div className="absolute -left-3 top-0 z-50 -rotate-[8.646deg] transform items-center justify-center gap-2.5 border border-slate-200 bg-primary-100 px-1 py-2">
            <p className="font-sans text-xs font-medium leading-4 text-primary-500">
              {avatar}
            </p>
          </div>
          <Image src={getAvatarImage(avatar)} alt="Avatar" fill={true} />
        </div>
      </>
    )}
    </div>
  );
};

export default Avatar;
