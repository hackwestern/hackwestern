
import React from 'react';
import Image from "next/image";

type AvatarType = {
  avatar: "Wildlife Wanderer" | "City Cruiser" | "Foodie Fanatic" | "Beach Bum" | null | undefined;
};

const Avatar = ( {avatar}: AvatarType ) => {
  const getAvatarImage = () => {
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
  };

  return (
    <div className="flex pr-[18.896px] flex-col justify-end items-center">
      <Image src={getAvatarImage()} alt="Avatar" width={200} height={204}/>
      <div className="transform -rotate-[8.646deg] p-[4px_8px] justify-center items-center absolute left-[2%] top-[47%] gap-[10px] border border-[#DCDFE9] bg-[#F8F5FF]">
        <p className="text-[#976CDF] font-sans text-[13px] font-medium leading-[18px]">{avatar}</p>
      </div>
    </div>
  );
};

export default Avatar;