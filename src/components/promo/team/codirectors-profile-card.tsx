import Image from "next/image";
import {
  CoDirectorFrame,
  MarketingFrame,
  DefaultFrame,
  DesignLeadFrame,
  MarketingLeadFrame,
  SponsorshipLeadFrame,
  SponsorshipOrganizerFrame,
  EventsOrganizerFrame,
  EventsLeadFrame,
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
  roundFrame?: boolean;
  roundImage?: boolean;
  webRoleSide?: "left" | "right";
  webRoleTop?: string | number;
  showCaption?: boolean;
  CustomFrame?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
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
    style: { width: 260, height: 300, padding: "12px" },
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
    style: { width: 169, height: 530, padding: "" },
    captionInside: true,
  },
  "events organizer": {
    Component: EventsOrganizerFrame,
    style: { width: 169, height: 530, padding: "12px 0px 0px 0px" },
    captionInside: false,
  },
  "events lead": {
    Component: EventsLeadFrame,
    style: { width: 169, height: 530, padding: "12px 0px 0px 0px" },
    captionInside: false,
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

function SideRole({
  role,
  side,
  top,
}: {
  role: string;
  side: "left" | "right";
  top?: string | number;
}) {
  return (
    <div
      className="absolute z-20 text-sm font-bold text-gray-500"
      style={{
        top: top ?? "60%",
        [side]: 30,
        transform:
          side === "right"
            ? "rotate(90deg) translateY(-50%)"
            : "rotate(90deg) translateY(50%)",
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
  const content = (
    <div className="flex flex-col items-center leading-tight">
      <span className="block">{name}</span>
      {!isWebLead && (
        <span className="text-md -mt-0.5 block leading-tight text-medium">
          {role}
        </span>
      )}
    </div>
  );

  if (captionInside) {
    return (
      <div
        className="absolute z-20 text-center font-figtree font-bold text-heavy"
        style={{
          bottom: isWebLead ? "0.5rem" : "1rem",
          width: frameWidth,
          left: 0,
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className="mt-2 text-center font-figtree font-bold text-heavy"
      style={{ width: frameWidth }}
    >
      {content}
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
  roundFrame = false,
  roundImage = false,
  webRoleSide = "right",
  webRoleTop,
  showCaption = true,
  CustomFrame,
}: Props) {
  const frameData = getFrameData(role);
  const Frame = CustomFrame ?? frameData.Component;
  const defaultFrameWidth = frameData.style.width as number;
  const defaultFrameHeight = frameData.style.height as number;
  const framePadding = frameData.style.padding as string;

  const frameWidthFinal = frameWidth ?? defaultFrameWidth;
  const frameHeightFinal = frameHeight ?? defaultFrameHeight;

  const isWebLead = role.toLowerCase() === "web lead";
  const isWebOrganizer = role.toLowerCase() === "web organizer";

  const imageOffset = isWebLead ? 20 : 0; // adjust as needed

  return (
    <div
      className="flex flex-col items-center"
      style={{ width: frameWidthFinal, ...style }}
    >
      <div
        className="relative"
        style={{
          width: frameWidthFinal,
          height: frameHeightFinal,
          padding: framePadding,
          transform: `rotate(${rotate}deg)`,
          backgroundColor: [
            "sponsorship lead",
            "sponsorship organizer",
            "web organizer",
          ].includes(role.toLowerCase())
            ? "transparent"
            : "white",
          boxShadow: [
            "sponsorship lead",
            "sponsorship organizer",
            "web organizer",
          ].includes(role.toLowerCase())
            ? "none"
            : "0 4px 6px rgba(0, 0, 0, 0.1)",
          borderRadius: roundFrame ? borderRadius : 0,
        }}
      >
        {isWebOrganizer ? (
          <svg
            width={frameWidthFinal}
            height={frameHeightFinal}
            className="absolute inset-0 z-0"
          >
            <Frame />
          </svg>
        ) : (
          <>
            <Frame className="absolute inset-0 z-0 h-full w-full" />
            <div
              style={{
                marginLeft:
                  isWebLead && webRoleSide === "left" ? imageOffset : 0,
                marginRight:
                  isWebLead && webRoleSide === "right" ? imageOffset : 0,
              }}
            >
              <Photo
                photo={photo}
                name={name}
                width={imageWidth ?? frameWidthFinal}
                height={imageHeight ?? frameHeightFinal}
                borderRadius={roundImage ? borderRadius : 0}
              />
            </div>
          </>
        )}

        {isWebLead && (
          <SideRole role={role} side={webRoleSide} top={webRoleTop} />
        )}

        {/* Captions */}
        {!isWebOrganizer && frameData.captionInside && showCaption && (
          <Caption
            name={name}
            role={role}
            isWebLead={isWebLead}
            captionInside
            frameWidth={frameWidthFinal}
          />
        )}
        {!isWebOrganizer && !frameData.captionInside && showCaption && (
          <div
            className="absolute left-0 right-0 text-center font-figtree font-bold"
            style={{ bottom: "-3rem", width: frameWidthFinal }}
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
