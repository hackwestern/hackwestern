/* eslint-disable @next/next/no-img-element */
import { colors } from "~/constants/avatar";
import { getAccessoryFromId } from "./form/avatar-form";

type AvatarDisplayProps = {
  avatarColour?: string | null;
  avatarFace?: number | null;
  avatarLeftHand?: number | null;
  avatarRightHand?: number | null;
  avatarHat?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function AvatarDisplay({
  avatarColour,
  avatarFace,
  avatarLeftHand,
  avatarRightHand,
  avatarHat,
  size = "lg",
  className = "",
}: AvatarDisplayProps) {
  const selectedColor = colors.find(
    (c) => c.name === (avatarColour ?? "green"),
  );

  // Size variants
  const sizeClasses = {
    sm: {
      container: "h-32 w-32",
      face: "h-10 w-10",
      hat: "h-20 w-20 -top-6",
      hand: "h-6 w-6",
      handBottom: "bottom-10",
      handLeft: "-left-1.5",
      handRight: "-right-1.5",
    },
    md: {
      container: "h-48 w-48 -mb-8",
      face: "h-20 w-20",
      hat: "h-48 w-48 -top-10",
      hand: "h-12 w-12",
      handBottom: "bottom-16",
      handLeft: "-left-3",
      handRight: "-right-3",
    },
    lg: {
      container: "h-64 w-64",
      face: "h-24 w-24",
      hat: "h-56 w-56 -top-16",
      hand: "h-24 w-24",
      handBottom: "bottom-14",
      handLeft: "-left-10",
      handRight: "-right-10",
    },
  };

  const s = sizeClasses[size];

  return (
    <div
      className={`relative ${s.container} ${className} group:pointer-events-none pointer-events-none select-none group-hover:pointer-events-none`}
    >
      {/* Character Base */}
      <img
        src={`/avatar/body/${selectedColor?.body ?? "004"}.webp`}
        alt="Character body"
        className="h-full w-full object-contain"
      />

      {/* Selected Accessory - Face */}
      {avatarFace &&
        (() => {
          const faceAccessory = getAccessoryFromId("face", avatarFace);
          return faceAccessory ? (
            <div
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${s.face}`}
            >
              <img
                src={faceAccessory.src}
                alt={faceAccessory.name}
                className="h-full w-full object-contain"
              />
            </div>
          ) : null;
        })()}

      {/* Selected Accessory - Hat */}
      {avatarHat &&
        (() => {
          const hatAccessory = getAccessoryFromId("hat", avatarHat);
          return hatAccessory ? (
            <div className={`absolute left-1/2 -translate-x-1/2 ${s.hat}`}>
              <img
                src={hatAccessory.src}
                alt={hatAccessory.name}
                className={`h-full w-full ${hatAccessory.sizing ?? ""} object-contain`}
              />
            </div>
          ) : null;
        })()}

      {/* Selected Accessory - Left Hand */}
      {avatarLeftHand &&
        (() => {
          const leftAccessory = getAccessoryFromId("left", avatarLeftHand);
          return leftAccessory ? (
            <div className={`absolute ${s.handLeft} ${s.handBottom} ${s.hand}`}>
              <img
                src={leftAccessory.src}
                alt={leftAccessory.name}
                className="h-full w-full object-contain"
              />
            </div>
          ) : null;
        })()}

      {/* Selected Accessory - Right Hand */}
      {avatarRightHand &&
        (() => {
          const rightAccessory = getAccessoryFromId("right", avatarRightHand);
          return rightAccessory ? (
            <div
              className={`absolute ${s.handRight} ${s.handBottom} ${s.hand}`}
            >
              <img
                src={rightAccessory.src}
                alt={rightAccessory.name}
                className="h-full w-full object-contain"
              />
            </div>
          ) : null;
        })()}
    </div>
  );
}
