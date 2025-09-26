import Image from "next/image";
import {
  CoDirectorFrame,
  MarketingFrame,
  DefaultFrame,
  DesignLeadFrame,
  MarketingLeadFrame,
  SponsorshipLeadFrame,
  SponsorshipOrganizerFrame,
  WebLeadFrame,
  WebFrame,
} from "./frames";

type Props = {
  name: string;
  role: string;
  photo: string;
  imageWidth?: number;
  imageHeight?: number;
  frameWidth?: number;
  frameHeight?: number;
  rotate?: number;
  style?: React.CSSProperties;
  borderRadius?: string | number;
  webRoleSide?: "left" | "right";
};

type FrameConfig = {
  Component: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  style: React.CSSProperties;
  captionInside?: boolean;
};

const frameMap: Record<string, FrameConfig> = {
  "co-director": {
    Component: CoDirectorFrame,
    style: { width: 196, height: 253, padding: "12px 8px 8px 8px" },
    captionInside: true,
  },
  "marketing organizer": {
    Component: MarketingFrame,
    style: { width: 260, height: 300, padding: "12px " },
    captionInside: true,
  },
  "design lead": {
    Component: DesignLeadFrame,
    style: { width: 260, height: 300, padding: "18px 20px 8px 20px" },
    captionInside: false,
  },
  "design organizer": {
    Component: DesignLeadFrame,
    style: { width: 260, height: 300, padding: "18px 0px 8px 0px" },
    captionInside: false,
  },

  "marketing lead": {
    Component: MarketingLeadFrame,
    style: { width: 250, height: 343, padding: "28px 0px 0px 0px" },
    captionInside: true,
  },
  "sponsorship lead": {
    Component: SponsorshipLeadFrame,
    style: { width: 316, height: 347, padding: "20px 0px 0px 0px" },
    captionInside: true,
  },
  "sponsorship organizer": {
    Component: SponsorshipOrganizerFrame,
    style: { width: 209, height: 209, padding: "20px 0px 0px 0px" },
    captionInside: true,
  },
  "web lead": {
    Component: WebLeadFrame,
    style: { width: 248, height: 226, padding: "16px 35px 30px 12px" },
    captionInside: true,
  },
  "web organizer": {
    Component: WebFrame,
    style: { width: 248, height: 226, padding: "16px 35px 30px 12px" },
    captionInside: true,
  },
  events: {
    Component: DefaultFrame,
    style: { width: 196, height: 253, padding: "12px 8px 8px 8px" },
  },
};

function getFrameData(role: string): FrameConfig {
  return (
    frameMap[role.toLowerCase()] ?? {
      Component: DefaultFrame,
      style: { width: 196, height: 253, padding: "12px 8px 8px 8px" },
      captionInside: true,
    }
  );
}

/* ---- Subcomponents ---- */

function Photo({
  photo,
  name,
  width,
  height,
  borderRadius,
}: {
  photo: string;
  name: string;
  width: number;
  height: number;
  borderRadius: string | number;
}) {
  return (
    <div
      className="relative z-10 mx-auto overflow-hidden"
      style={{ width, height, borderRadius }}
    >
      <Image
        src={photo}
        alt={name}
        fill
        className="object-cover"
        style={{ borderRadius }}
      />
    </div>
  );
}

function SideRole({ role, side }: { role: string; side: "left" | "right" }) {
  return (
    <div
      className="absolute z-20 text-xs font-bold text-gray-500"
      style={{
        top: "60%",
        [side]: 30,
        transform:
          side === "right"
            ? "rotate(90deg) translateY(-50%)"
            : "rotate(90deg) translateY(100%)",
        transformOrigin: side === "right" ? "right center" : "left center",
      }}
    >
      {role}
    </div>
  );
}

function Caption({
  name,
  role,
  isWebLead,
  captionInside,
  frameWidth,
}: {
  name: string;
  role: string;
  isWebLead: boolean;
  captionInside?: boolean;
  frameWidth: number;
}) {
  if (captionInside) {
    return (
      <div
        className="absolute z-20 text-center font-figtree font-bold text-heavy"
        style={{
          bottom: isWebLead ? "0.5rem" : ".5rem",
          width: frameWidth, // lock to card width
          left: 0, // anchor inside frame
        }}
      >
        {name}
        {!isWebLead && (
          <div className="font-figtree text-sm text-medium">{role}</div>
        )}
      </div>
    );
  }

  return (
    <div
      className="mt-2 text-center font-figtree font-bold text-heavy"
      style={{ width: frameWidth }}
    >
      {name}
      {!isWebLead && (
        <div className="font-figtree text-sm text-medium">{role}</div>
      )}
    </div>
  );
}
/* ---- Main Component ---- */

export function CdCard({
  name,
  role,
  photo,
  imageWidth,
  imageHeight,
  frameWidth,
  frameHeight,
  style,
  rotate = 0,
  borderRadius = "8px",
  webRoleSide = "right",
}: Props) {
  const frameData = getFrameData(role);
  const Frame = frameData.Component;
  const defaultFrameWidth = frameData.style.width as number;
  const defaultFrameHeight = frameData.style.height as number;
  const framePadding = frameData.style.padding as string;

  const frameWidthFinal = frameWidth ?? defaultFrameWidth;
  const frameHeightFinal = frameHeight ?? defaultFrameHeight;
  const isWebLead = role.toLowerCase() === "web lead";

  return (
    <div
      className="flex flex-col items-center"
      style={{ width: frameWidthFinal, ...style }} // 👈 lock parent width
    >
      {/* Frame + Photo + Caption (rotates together) */}
      <div
        className="relative"
        style={{
          width: frameWidthFinal,
          height: frameHeightFinal,
          padding: framePadding,
          transform: `rotate(${rotate}deg)`,
          backgroundColor:
            role.toLowerCase() === "sponsorship lead" ||
            role.toLowerCase() === "sponsorship organizer"
              ? "transparent"
              : "white",
          boxShadow:
            role.toLowerCase() === "sponsorship lead" ||
            role.toLowerCase() === "sponsorship organizer"
              ? "none"
              : "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
      >
        {" "}
        <Frame className="absolute inset-0 z-0 h-full w-full" />
        <Photo
          photo={photo}
          name={name}
          width={imageWidth ?? frameWidthFinal}
          height={imageHeight ?? frameHeightFinal}
          borderRadius={borderRadius}
        />
        {isWebLead && <SideRole role={role} side={webRoleSide} />}
        {/* Inside caption (unchanged) */}
        {frameData.captionInside && (
          <Caption
            name={name}
            role={role}
            isWebLead={isWebLead}
            captionInside
            frameWidth={frameWidthFinal}
          />
        )}
        {/* Outside caption BUT still rotates with parent */}
        {!frameData.captionInside && (
          <div
            className="absolute left-0 right-0 text-center font-figtree font-bold"
            style={{ bottom: "-3rem", width: frameWidthFinal }} // push it outside frame
          >
            <Caption
              name={name}
              role={role}
              isWebLead={isWebLead}
              captionInside={false}
              frameWidth={frameWidthFinal}
            />
          </div>
        )}
      </div>
    </div>
  );
}
