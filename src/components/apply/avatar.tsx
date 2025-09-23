import { useRouter } from "next/router";
import React, { useState } from "react";

export const Avatar = () => {
  const router = useRouter();

  const [selectedColor, setSelectedColor] = useState("green");
  const [selectedAccessories, setSelectedAccessories] = useState({
    face: "",
    right: "",
    left: "",
    hat: "",
    special: "",
  });
  const [selectedCategory, setSelectedCategory] = useState("face");

  const colors = [
    {
      name: "brown",
      value: "#D0816B",
      gradient: "#FFA59B",
      bg: "#F8DDD6",
      body: "001",
    },

    {
      name: "orange",
      value: "#F0AF73",
      gradient: "#FFCB9B",
      bg: "#FAE4CE",
      body: "002",
    },

    {
      name: "yellow",
      value: "#F9D962",
      gradient: "#FFE98D",
      bg: "#FEF7D7",
      body: "003",
    },

    {
      name: "green",
      value: "#A5CD72",
      gradient: "#A7FB73",
      bg: "#F1FDE0",
      body: "004",
    },
    {
      name: "blue",
      value: "#87C5EA",
      gradient: "#A9D5FF",
      bg: "#D8F0FF",
      body: "005",
    },
    {
      name: "purple",
      value: "#B592DA",
      gradient: "#E1C2FF",
      bg: "#F0E6F8",
      body: "006",
    },

    {
      name: "pink",
      value: "#EAAFB3",
      gradient: "#FEBFCB",
      bg: "#F7E0EA",
      body: "007",
    },
  ];

  const categories = [
    { id: "face", src: "/smile.png" },
    { id: "left", src: "/lefthand.png" },
    { id: "right", src: "/righthand.png" },
    { id: "hat", src: "/hat.png" },
    { id: "special", src: "/star.png" },
  ];

  const getAccessoriesForCategory = (category: string) => {
    switch (category) {
      case "face":
        return [
          { id: "face1", name: "Face 1", src: "/avatar/face/001.webp" },
          { id: "face2", name: "Face 2", src: "/avatar/face/002.webp" },
          { id: "face3", name: "Face 3", src: "/avatar/face/003.webp" },
          { id: "face4", name: "Face 4", src: "/avatar/face/004.webp" },
          { id: "face5", name: "Face 5", src: "/avatar/face/005.webp" },
          { id: "face6", name: "Face 6", src: "/avatar/face/006.webp" },
          { id: "face7", name: "Face 7", src: "/avatar/face/007.webp" },
          { id: "face8", name: "Face 8", src: "/avatar/face/008.webp" },
          { id: "face9", name: "Face 9", src: "/avatar/face/009.webp" },
          { id: "face10", name: "Face 10", src: "/avatar/face/010.webp" },
          { id: "face11", name: "Face 11", src: "/avatar/face/011.webp" },
          { id: "face12", name: "Face 12", src: "/avatar/face/012.webp" },
          { id: "face13", name: "Face 13", src: "/avatar/face/013.webp" },
          { id: "face14", name: "Face 14", src: "/avatar/face/014.webp" },
          { id: "none1", name: "", src: "" },
          { id: "none2", name: "", src: "" },
          { id: "none3", name: "", src: "" },
          { id: "none4", name: "", src: "" },
          { id: "none5", name: "", src: "" },
          { id: "none6", name: "", src: "" },
        ];
      case "right":
        return [
          { id: "right1", name: "Right 1", src: "/avatar/right/001.webp" },
          { id: "right2", name: "Right 2", src: "/avatar/right/002.webp" },
          { id: "right3", name: "Right 3", src: "/avatar/right/003.webp" },
          { id: "right4", name: "Right 4", src: "/avatar/right/004.webp" },
          { id: "right5", name: "Right 5", src: "/avatar/right/005.webp" },
          { id: "right6", name: "Right 6", src: "/avatar/right/006.webp" },
          { id: "right7", name: "Right 7", src: "/avatar/right/007.webp" },
          { id: "right8", name: "Right 8", src: "/avatar/right/008.webp" },
          { id: "right9", name: "Right 9", src: "/avatar/right/009.webp" },
          { id: "right10", name: "Right 10", src: "/avatar/right/010.webp" },
          { id: "right11", name: "Right 11", src: "/avatar/right/011.webp" },
          { id: "right12", name: "Right 12", src: "/avatar/right/012.webp" },
          { id: "none1", name: "", src: "" },
          { id: "none2", name: "", src: "" },
          { id: "none3", name: "", src: "" },
          { id: "none4", name: "", src: "" },
          { id: "none5", name: "", src: "" },
          { id: "none6", name: "", src: "" },
        ];
      case "left":
        return [
          { id: "left1", name: "Left 1", src: "/avatar/left/001.webp" },
          { id: "left2", name: "Left 2", src: "/avatar/left/002.webp" },
          { id: "left3", name: "Left 3", src: "/avatar/left/003.webp" },
          { id: "left4", name: "Left 4", src: "/avatar/left/004.webp" },
          { id: "left5", name: "Left 5", src: "/avatar/left/005.webp" },
          { id: "left6", name: "Left 6", src: "/avatar/left/006.webp" },
          { id: "left7", name: "Left 7", src: "/avatar/left/007.webp" },
          { id: "left8", name: "Left 8", src: "/avatar/left/008.webp" },
          { id: "left9", name: "Left 9", src: "/avatar/left/009.webp" },
          { id: "left10", name: "Left 10", src: "/avatar/left/010.webp" },
          { id: "left11", name: "Left 11", src: "/avatar/left/011.webp" },
          { id: "left12", name: "Left 12", src: "/avatar/left/012.webp" },
          { id: "none1", name: "", src: "" },
          { id: "none2", name: "", src: "" },
          { id: "none3", name: "", src: "" },
          { id: "none4", name: "", src: "" },
          { id: "none5", name: "", src: "" },
          { id: "none6", name: "", src: "" },
        ];
      case "hat":
        return [
          { id: "hat1", name: "Hat 1", src: "/avatar/hat/001.webp" },
          { id: "hat2", name: "Hat 2", src: "/avatar/hat/002.webp" },
          { id: "hat3", name: "Hat 3", src: "/avatar/hat/003.webp" },
          { id: "hat4", name: "Hat 4", src: "/avatar/hat/004.webp" },
          { id: "hat5", name: "Hat 5", src: "/avatar/hat/005.webp" },
          { id: "hat6", name: "Hat 6", src: "/avatar/hat/006.webp" },
          { id: "hat7", name: "Hat 7", src: "/avatar/hat/007.webp" },
          { id: "hat8", name: "Hat 8", src: "/avatar/hat/008.webp" },
          { id: "hat9", name: "Hat 9", src: "/avatar/hat/009.webp" },
          { id: "hat10", name: "Hat 10", src: "/avatar/hat/010.webp" },
          { id: "hat11", name: "Hat 11", src: "/avatar/hat/011.webp" },
          { id: "hat12", name: "Hat 12", src: "/avatar/hat/012.webp" },
          { id: "hat13", name: "Hat 13", src: "/avatar/hat/013.webp" },
          { id: "hat14", name: "Hat 14", src: "/avatar/hat/014.webp" },
          { id: "hat15", name: "Hat 15", src: "/avatar/hat/015.webp" },
          { id: "hat16", name: "Hat 16", src: "/avatar/hat/016.webp" },
          { id: "hat17", name: "Hat 17", src: "/avatar/hat/017.webp" },
          { id: "hat18", name: "Hat 18", src: "/avatar/hat/018.webp" },
          { id: "hat19", name: "Hat 19", src: "/avatar/hat/019.webp" },
          { id: "hat20", name: "Hat 20", src: "/avatar/hat/020.webp" },
          { id: "hat21", name: "Hat 21", src: "/avatar/hat/021.webp" },
          { id: "hat22", name: "Hat 22", src: "/avatar/hat/022.webp" },
          { id: "hat23", name: "Hat 23", src: "/avatar/hat/023.webp" },
          { id: "none1", name: "", src: "" },
          { id: "none2", name: "", src: "" },
          { id: "none3", name: "", src: "" },
          { id: "none4", name: "", src: "" },
          { id: "none5", name: "", src: "" },
          { id: "none6", name: "", src: "" },
        ];
      case "special":
        return [
          { id: "none1", name: "", src: "" },
          { id: "none2", name: "", src: "" },
          { id: "none3", name: "", src: "" },
          { id: "none4", name: "", src: "" },
          { id: "none5", name: "", src: "" },
          { id: "none6", name: "", src: "" },
          { id: "none7", name: "", src: "" },
          { id: "none8", name: "", src: "" },
          { id: "none9", name: "", src: "" },
          { id: "none10", name: "", src: "" },
          { id: "none11", name: "", src: "" },
          { id: "none12", name: "", src: "" },
          { id: "none13", name: "", src: "" },
          { id: "none14", name: "", src: "" },
          { id: "none15", name: "", src: "" },
          { id: "none16", name: "", src: "" },
          { id: "none17", name: "", src: "" },
          { id: "none18", name: "", src: "" },
          { id: "none19", name: "", src: "" },
          { id: "none20", name: "", src: "" },
          { id: "none21", name: "", src: "" },
          { id: "none22", name: "", src: "" },
          { id: "none23", name: "", src: "" },
          { id: "none24", name: "", src: "" },
          { id: "none25", name: "", src: "" },
          { id: "none26", name: "", src: "" },
        ];
      default:
        return [];
    }
  };

  const handleNext = () => {
    // Save character data and navigate to next step
    router.push("/apply");
  };

  const handleBack = () => {
    router.back();
  };

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
  ${colors.find((c) => c.name === selectedColor)?.bg || "#F1FDE0"} 30%,
  ${colors.find((c) => c.name === selectedColor)?.gradient || "#A7FB73"} 95%
)`,
              }}
            >
              <div className="flex h-full items-center justify-center">
                <div className="relative">
                  {/* Character Base */}
                  <div className="h-64 w-64">
                    <img
                      src={`/avatar/body/${colors.find((c) => c.name === selectedColor)?.body || "002"}.webp`}
                      alt="Character body"
                      className="h-full w-full object-contain"
                    />
                  </div>

                  {/* Selected Accessory - Face */}
                  {selectedAccessories.face &&
                    selectedAccessories.face.startsWith("face") && (
                      <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2">
                        <img
                          src={`/avatar/face/${selectedAccessories.face.replace("face", "").padStart(3, "0")}.webp`}
                          alt={selectedAccessories.face}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}

                  {/* Selected Accessory - Hat */}
                  {selectedAccessories.hat &&
                    selectedAccessories.hat.startsWith("hat") && (
                      <div className="absolute -top-3 left-1/2 h-16 w-16 -translate-x-1/2">
                        <img
                          src={`/avatar/hat/${selectedAccessories.hat.replace("hat", "").padStart(3, "0")}.webp`}
                          alt={selectedAccessories.hat}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}

                  {/* Selected Accessory - Left Hand */}
                  {selectedAccessories.left &&
                    selectedAccessories.left.startsWith("left") && (
                      <div className="absolute -left-4 bottom-20 h-16 w-16">
                        <img
                          src={`/avatar/left/${selectedAccessories.left.replace("left", "").padStart(3, "0")}.webp`}
                          alt={selectedAccessories.left}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}

                  {/* Selected Accessory - Right Hand */}
                  {selectedAccessories.right &&
                    selectedAccessories.right.startsWith("right") && (
                      <div className="absolute -right-4 bottom-20 h-16 w-16">
                        <img
                          src={`/avatar/right/${selectedAccessories.right.replace("right", "").padStart(3, "0")}.webp`}
                          alt={selectedAccessories.right}
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
                          [selectedCategory]: accessory.id,
                        }));
                      }}
                      className={`flex aspect-[7/5] w-full items-center justify-center rounded-lg border-2 transition-all hover:scale-105 ${
                        selectedAccessories[
                          selectedCategory as keyof typeof selectedAccessories
                        ] === accessory.id
                          ? "bg-lilac"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                      style={
                        selectedAccessories[
                          selectedCategory as keyof typeof selectedAccessories
                        ] === accessory.id
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
