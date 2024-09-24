import { ChangeEvent, useState } from "react";
import Avatar from "./avatar";

type AvatarType =
  | "Wildlife Wanderer"
  | "City Cruiser"
  | "Foodie Fanatic"
  | "Beach Bum"
  | null
  | undefined;

interface AvatarRadioProps {
    value: AvatarType;
    onChange: (avatar: AvatarType) => void;
}

const avatarOptions: AvatarType[] = [
    "Wildlife Wanderer",
    "City Cruiser",
    "Foodie Fanatic",
    "Beach Bum"
  ];

const AvatarRadioGroup = ({ value, onChange }: AvatarRadioProps) => {
    const [selectedAvatar, setSelectedAvatar] = useState<AvatarType | null>(value);

    const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
        const avatar = e.target.value as AvatarType;
        setSelectedAvatar(avatar);
        onChange(avatar);
    };

  return (
    <div className="grid grid-cols-2 gap-8">
      {avatarOptions.map((option, index) => (
        <label
            key={index}
            className="flex w-full cursor-pointer"
        >
        <input
            type="radio"
            name="avatar"
            checked={selectedAvatar === option}
            onChange={onSelect}
            className="hidden"
        />
        <Avatar avatar={option} className={`transition-opacity duration-200 ${
            selectedAvatar === option ? "opacity-100" : "opacity-50"
        }`}/>
        </label>
      ))}
    </div>
  );
};

export default AvatarRadioGroup;
