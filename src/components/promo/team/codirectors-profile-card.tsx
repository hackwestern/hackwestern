import Image from "next/image";
import {
  CoDirectorFrame,
  MarketingFrame,
  DefaultFrame,
  DesignLeadFrame,
  MarketingLeadFrame,
  SponsorshipLeadFrame,
  // SponsorshipFrame, WebFrame, EventsFrame
} from "./frames";

type Props = {
  name: string;
  role: string;
  photo: string;
  imageWidth?: number; // size of the photo inside the frame
  imageHeight?: number;
  rotate?: number;
  style?: React.CSSProperties; // NEW: for positioning on the page
  borderRadius?: string | number; // NEW: allow dynamic rounding
};

// Map roles to frame components AND their specific wrapper styles
const frameMap: Record<
  string,
  {
    Component: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    style: React.CSSProperties;
    captionInside?: boolean; // NEW: whether the caption is inside the frame
  }
> = {
  "co-director": {
    Component: CoDirectorFrame,
    style: { width: 196, height: 253, padding: "12px 8px 8px 8px" },
  },
  marketing: {
    Component: MarketingFrame,
    style: { width: 260, height: 300, padding: "12px 8px 8px 8px" },
  },
  "design lead": {
    Component: DesignLeadFrame,
    style: { width: 260, height: 300, padding: "12px 8px 8px 8px" },
    captionInside: false,
  },
  "marketing lead": {
    Component: MarketingLeadFrame,
    style: { width: 250, height: 343, padding: "28px 0px 0px 0px" },
    captionInside: true,
  },
  "sponsorship lead": {
    Component: SponsorshipLeadFrame,
    style: { width: 316, height: 347, padding: "" },
  },
  web: {
    Component: DefaultFrame,
    style: { width: 210, height: 270, padding: "12px" },
  },
  events: {
    Component: DefaultFrame,
    style: { width: 196, height: 253, padding: "12px 8px 8px 8px" },
  },
};

export function CdCard({
  name,
  role,
  photo,
  imageWidth,
  imageHeight,
  style,
  rotate = 0,
  borderRadius = "8px", // default same as before
}: Props) {
  const frameData = frameMap[role.toLowerCase()] ?? {
    Component: DefaultFrame,
    style: { width: 196, height: 253, padding: "12px 8px 8px 8px" },
    captionInside: true,
  };
  const Frame = frameData.Component;
  const frameWidth = frameData.style.width as number;
  const frameHeight = frameData.style.height as number;
  const framePadding = frameData.style.padding as string;

  return (
    <div
      className="relative flex flex-col items-center gap-3 bg-transparent "
      style={{
        width: frameWidth,
        height: frameHeight,
        padding: framePadding,
        transform: `rotate(${rotate}deg)`,
        ...style,
      }}
    >
      {/* Frame */}
      <Frame className="absolute inset-0 z-0 h-full w-full" />
      {/* Photo with exact size */}
      <div
        className="relative z-10 mx-auto overflow-hidden"
        style={{
          width: imageWidth ?? frameWidth,
          height: imageHeight ?? frameHeight,
          borderRadius, // apply dynamic rounding
        }}
      >
        <Image
          src={photo}
          alt={name}
          fill
          className="object-cover"
          style={{ borderRadius }} // also apply to Image for Safari / consistency
        />
      </div>
      {/* Name + Role */}
      {frameData.captionInside ? (
        <div className="absolute bottom-4 z-20 w-full text-center text-sm font-bold">
          {name}
          <div className="text-xs text-gray-500">{role}</div>
        </div>
      ) : (
        <div className="mt-2 w-full text-center text-sm font-bold">
          {name}
          <div className="text-xs text-gray-500">{role}</div>
        </div>
      )}
    </div>
  );
}
