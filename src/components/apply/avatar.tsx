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
          <div className="relative h-[140px] w-[140px] overflow-hidden md:h-[170px] md:w-[170px] xl:h-[200px] xl:w-[200px] 2xl:h-[250px] 2xl:w-[250px] 3xl:h-[320px] 3xl:w-[320px] 4xl:h-[400px] 4xl:w-[400px]">
            <div className="absolute left-2 top-1">
              <p className="text-sm text-slate-500">{avatar}</p>
            </div>
            <div className="flex flex-col items-center justify-end">
              <Image src={getAvatarImage(avatar)} alt="Avatar" fill={true} />
            </div>
          </div>
        </>
      )}
      {!selection && avatar && (
        <>
          <div className="relative flex aspect-square flex-col items-center justify-end rounded-lg bg-primary-200">
            <div className="justify-top absolute -left-2 top-[1px] z-50 -rotate-[8.646deg] transform items-center gap-2.5 border border-slate-200 bg-primary-100 px-1 py-2">
              <p className="font-sans text-xs font-medium leading-4 text-primary-500">
                {avatar}
              </p>
            </div>
            <Image
              src={getAvatarImage(avatar)}
              alt="Avatar"
              width={250}
              height={250}
              draggable="false"
            />
          </div>
        </>
      )}
      {!avatar && (
        <div className="flex h-40 w-40 items-center justify-center rounded-lg bg-primary-200" />
      )}
    </div>
  );
};

export default Avatar;
