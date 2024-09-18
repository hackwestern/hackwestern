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
    <div className="flex flex-col items-center justify-end pr-[18.896px]">
      <Image
        src={getAvatarImage(avatar)}
        alt="Avatar"
        width={200}
        height={204}
      />
      <div className="absolute left-[2%] top-[47%] -rotate-[8.646deg] transform items-center justify-center gap-[10px] border border-[#DCDFE9] bg-[#F8F5FF] p-[4px_8px]">
        <p className="font-sans text-[13px] font-medium leading-[18px] text-[#976CDF]">
          {avatar}
        </p>
      </div>
    </div>
  );
};

export default Avatar;
