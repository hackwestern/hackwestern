import React from "react";
import Image from "next/image";

// using PNG for performance reasons
export const Bindings = React.memo(function Bindings() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-[51px] pt-[26px]">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="w-[60px]">
          <Image
            src="/images/promo/team/binding.png"
            alt="Binding"
            width={500}
            height={500}
            draggable={false}
            className="h-auto w-full" // Scale down to container
          />
        </div>
      ))}
    </div>
  );
});

export const LeftCover = React.memo(function LeftCover() {
  return (
    <div className="absolute left-0 top-0 z-[-5] mr-[18px] mt-2 h-[700px] w-[553.75px] rounded-l-[20px] rounded-r-[8px] bg-gradient-to-l from-[#7E4C9B] to-[#C296EB] drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]" />
  );
});

export const RightCover = React.memo(function RightCover() {
  return (
    <div className="absolute right-0 top-0 z-[-5] ml-[18px] mt-2 h-[700px] w-[553.75px] rounded-l-[8px] rounded-r-[20px] bg-gradient-to-r from-[#7E4C9B] to-[#C296EB] drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
  );
});

const maskImage =
  "radial-gradient(circle at center, transparent 12px, black 12px), linear-gradient(black, black)";

const maskSize = "30px 80px, calc(100% - 30px) 100%";

const maskRepeat = "repeat-y, no-repeat";

const pageHoleMask: React.CSSProperties = {
  maskImage,
  maskSize,
  maskRepeat,
  WebkitMaskImage: maskImage,
  WebkitMaskSize: maskSize,
  WebkitMaskRepeat: maskRepeat,
};

const frontPos = "0px 340px, 30px 0";

const frontPageHoleMask: React.CSSProperties = {
  ...pageHoleMask,
  maskPosition: frontPos,
  WebkitMaskPosition: frontPos,
};

const backPos = "right 340px, left 0";

const backPageHoleMask: React.CSSProperties = {
  ...pageHoleMask,
  maskPosition: backPos,
  WebkitMaskPosition: backPos,
};

export const FrontHoles = React.memo(function FrontHoles() {
  return (
    <>
      <div style={frontPageHoleMask} className="h-[723px] w-[18px] bg-beige" />
      <div
        style={{ transform: "rotateY(180deg)", ...frontPageHoleMask }}
        className="-ml-[4px] -mr-[2px] h-[723px] w-[18px] bg-beige"
      />
    </>
  );
});

export const BackHoles = React.memo(function BackHoles() {
  return (
    <>
      <div
        style={{ transform: "rotateY(180deg)", ...backPageHoleMask }}
        className="-mr-[4px] h-[723px] w-[18px] bg-beige"
      />
      <div style={backPageHoleMask} className="h-[723px] w-[18px] bg-beige" />
    </>
  );
});
