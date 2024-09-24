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
  className: string;
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

const Avatar = ({ avatar }: AvatarProps) => {
  return (
    <div className="relative w-[160px] h-[160px]">
      <div className="absolute top-1 left-3">
        <p className="text-sm text-[#222734]">
          {avatar}
        </p>
      </div>
      <div className="flex flex-col items-center justify-end">
        <Image
          src={getAvatarImage(avatar)}
          alt="Avatar"
          width={160}
          height={150}
        />
      </div>
    </div>
  );
};

export default Avatar;
