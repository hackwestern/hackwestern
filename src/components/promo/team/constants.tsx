import React from "react";

// using PNG for performance reasons
export const Bindings = React.memo(function Bindings() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[10] flex flex-col items-center justify-center gap-8 pt-4">
      {Array.from({ length: 10 }).map((_, index) => (
        // DON'T USE NEXT IMAGE OR IT WILL "OPTIMIZE" THE PNG TOO SMALL
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          src="/images/promo/team/binding.png"
          alt="Binding"
          width={60}
          draggable={false}
        />
      ))}
    </div>
  );
});

export function LeftCover() {
  return (
    <svg
      width="555"
      height="723"
      viewBox="0 0 555 723"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute left-0 top-0 ml-[3px] h-full w-1/2"
    >
      <g filter="url(#filter0_d_857_2218)">
        <path
          d="M4 22C4 10.9543 12.9543 2 24 2L543 2C547.418 2 551 5.58172 551 10V709C551 713.418 547.418 717 543 717H24C12.9543 717 4 708.046 4 697L4 22Z"
          fill="url(#paint0_linear_857_2218)"
        />
      </g>
      <defs>
        <filter
          id="filter0_d_857_2218"
          x="0"
          y="0"
          width="555"
          height="723"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow_857_2218"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_857_2218"
            result="shape"
          />
        </filter>
        <linearGradient
          id="paint0_linear_857_2218"
          x1="551"
          y1="359"
          x2="-496"
          y2="359"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8F57AD" />
          <stop offset="1" stopColor="#D19AEE" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function RightCover() {
  return (
    <svg
      width="555"
      height="723"
      viewBox="0 0 555 723"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute right-0 top-0 mr-[3px] h-full w-1/2"
    >
      <g filter="url(#filter0_d_857_2225)">
        <path
          d="M551 697C551 708.046 542.046 717 531 717L11.9999 717C7.58167 717 3.99994 713.418 3.99994 709L4.00001 10C4.00001 5.58174 7.58173 2.00002 12 2.00002L531 2.00006C542.046 2.00006 551 10.9543 551 22.0001L551 697Z"
          fill="url(#paint0_linear_857_2225)"
        />
      </g>
      <defs>
        <filter
          id="filter0_d_857_2225"
          x="0"
          y="0"
          width="555"
          height="723"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow_857_2225"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_857_2225"
            result="shape"
          />
        </filter>
        <linearGradient
          id="paint0_linear_857_2225"
          x1="3.99999"
          y1="360"
          x2="1051"
          y2="360"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8F57AD" />
          <stop offset="1" stopColor="#D19AEE" />
        </linearGradient>
      </defs>
    </svg>
  );
}
