// import { useRouter } from "next/router";
import React, { useState } from "react";
/* eslint-disable @next/next/no-img-element */
import { categories, colors, avatarManifest } from "../../constants/avatar";
import type { AvatarObject } from "../../constants/avatar";

export const Avatar = () => {
  // const router = useRouter();

  const [selectedColor, setSelectedColor] = useState("green");
  const [selectedAccessories, setSelectedAccessories] = useState<{
    face: AvatarObject | null;
    right: AvatarObject | null;
    left: AvatarObject | null;
    hat: AvatarObject | null;
  }>({
    face: null,
    right: null,
    left: null,
    hat: null,
  });

  const [selectedCategory, setSelectedCategory] = useState("face");

  const getAccessoriesForCategory = (category: string) => {
    switch (category) {
      case "face":
        return avatarManifest.face.map(
          (AvatarEntry) =>
            ({
              id: AvatarEntry.id,
              name: AvatarEntry.alt,
              src: AvatarEntry.file,
            }) as AvatarObject,
        );

      case "right":
        return avatarManifest.right.map(
          (AvatarEntry) =>
            ({
              id: AvatarEntry.id,
              name: AvatarEntry.alt,
              src: AvatarEntry.file,
            }) as AvatarObject,
        );

      case "left":
        return avatarManifest.left.map(
          (AvatarEntry) =>
            ({
              id: AvatarEntry.id,
              name: AvatarEntry.alt,
              src: AvatarEntry.file,
            }) as AvatarObject,
        );
      case "hat":
        return avatarManifest.hat.map(
          (AvatarEntry) =>
            ({
              id: AvatarEntry.id,
              name: AvatarEntry.alt,
              src: AvatarEntry.file,
              sizing: AvatarEntry?.sizing,
            }) as AvatarObject,
        );

      default:
        return [];
    }
  };

  // const handleNext = () => {
  //   // Save character data and navigate to next step
  //   router.push("/apply");
  // };

  // const handleBack = () => {
  //   router.back();
  // };
  return (
    <>
      <div className="w-full max-w-[70%] overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="grid grid-cols-1 gap-4 md:gap-4 lg:grid-cols-[7fr_8fr]">
          {/* Left Side - Character Preview */}
          <div className="space-y-6">
            {/* Header */}
            <h1
              className="p-4 text-xl text-violet-950 sm:text-2xl md:text-3xl "
              style={{ fontFamily: "Dico, sans-serif" }}
            >
              Choose your character
            </h1>

            {/* Character Preview Area */}
            <div
              className="aspect-square rounded-2xl p-4"
              style={{
                background: `linear-gradient(
  135deg,
  ${colors.find((c) => c.name === selectedColor)?.bg ?? "#F1FDE0"} 30%,
  ${colors.find((c) => c.name === selectedColor)?.gradient ?? "#A7FB73"} 95%
)`,
              }}
            >
              <div className="flex h-full items-center justify-center">
                <div className="relative">
                  {/* Character Base */}
                  <div className="h-64 w-64">
                    <img
                      src={`/avatar/body/${colors.find((c) => c.name === selectedColor)?.body ?? "002"}.webp`}
                      alt="Character body"
                      className="h-full w-full object-contain"
                    />
                  </div>

                  {/* Selected Accessory - Face */}
                  {selectedAccessories.face && (
                    <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2">
                      <img
                        src={selectedAccessories.face.src}
                        alt={selectedAccessories.face.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}

                  {/* Selected Accessory - Hat */}
                  {selectedAccessories.hat && (
                    <div className="absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2">
                      <img
                        src={selectedAccessories.hat.src}
                        alt={selectedAccessories.hat.name}
                        className={`h-full w-full ${selectedAccessories.hat?.sizing} object-contain`}
                      />
                    </div>
                  )}

                  {/* Selected Accessory - Left Hand */}
                  {selectedAccessories.left && (
                    <div className="absolute -left-4 bottom-20 h-16 w-16">
                      <img
                        src={selectedAccessories.left.src}
                        alt={selectedAccessories.left.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}

                  {/* Selected Accessory - Right Hand */}
                  {selectedAccessories.right && (
                    <div className="absolute -right-4 bottom-20 h-16 w-16">
                      <img
                        src={selectedAccessories.right.src}
                        alt={selectedAccessories.right.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Color Palette */}
            <div className="space-y-3">
              <div className="flex justify-evenly">
                {colors.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(color.name)}
                    className={`h-8 w-8 rounded-lg transition-all hover:scale-110 ${
                      selectedColor === color.name
                        ? "ring-2 ring-purple-200"
                        : ""
                    }`}
                    style={{
                      backgroundColor: color.value,
                      borderTop: "1px solid rgba(0, 0, 0, 0.08)",
                      borderLeft: "1px solid rgba(0, 0, 0, 0.08)",
                      borderRight: "1px solid rgba(0, 0, 0, 0.08)",
                      borderBottom: "3px solid rgba(0, 0, 0, 0.08)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - Accessory Selection */}
          <div className="space-y-6 ">
            {/* Category Selection */}
            <div className="flex w-full gap-3 p-4">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex h-10 flex-1 items-center justify-center rounded-lg transition-all hover:scale-105 ${
                    selectedCategory === category.id
                      ? "bg-[#F5F2F6]"
                      : "bg-transparent hover:bg-gray-50"
                  }`}
                  title={category.id}
                >
                  <img
                    src={category.src}
                    alt={category.id}
                    className="h-6 w-6"
                  />
                </button>
              ))}
            </div>

            {/* Accessory Grid */}
            <div className="custom-scroll mt-4 aspect-square w-full overflow-y-auto overflow-x-hidden rounded-2xl pb-4 pl-4 pr-4 ">
              <div className="grid w-full grid-cols-3 gap-4">
                {getAccessoriesForCategory(selectedCategory).map(
                  (accessory) => (
                    <button
                      key={accessory.id}
                      onClick={() => {
                        setSelectedAccessories((prev) => ({
                          ...prev,
                          [selectedCategory]: accessory,
                        }));
                      }}
                      className={`flex aspect-[7/5] w-full items-center justify-center rounded-lg border-2 transition-all hover:scale-105 ${
                        selectedAccessories[
                          selectedCategory as keyof typeof selectedAccessories
                        ]?.id === accessory.id
                          ? "bg-lilac"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                      style={
                        selectedAccessories[
                          selectedCategory as keyof typeof selectedAccessories
                        ]?.id === accessory.id
                          ? { borderColor: "var(--hw-purple)" }
                          : {}
                      }
                    >
                      {accessory.src ? (
                        <img
                          src={accessory.src}
                          alt={accessory.name}
                          className="h-12 w-12 object-contain"
                        />
                      ) : (
                        <img
                          src={`/ellipse.png`}
                          alt="No selection"
                          className="h-8 w-8"
                        />
                      )}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
