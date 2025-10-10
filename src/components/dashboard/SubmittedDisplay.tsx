import React, { useRef, useState } from "react";
import { AvatarDisplay } from "~/components/apply/avatar-display";
import {
  MajorStamp,
  SchoolStamp,
  HackerStamp,
  HWStamp,
  LinksStamp,
} from "~/components/apply/stamp";
import type { major, numOfHackathons } from "~/server/db/schema";
import { toPng } from "html-to-image";
import { Button } from "../ui/button";
import { ExternalLink } from "lucide-react";

type MajorType = (typeof major.enumValues)[number];
type ExperienceType = (typeof numOfHackathons.enumValues)[number];

type ApplicationShape = {
  firstName?: string | null;
  lastName?: string | null;
  avatarColour?: string | null;
  avatarFace?: number | null;
  avatarLeftHand?: number | null;
  avatarRightHand?: number | null;
  avatarHat?: number | null;
  school?: string | null;
  major?: MajorType | null;
  attendedBefore?: boolean | null;
  numOfHackathons?: ExperienceType | null;
  githubLink?: string | null;
  linkedInLink?: string | null;
  otherLink?: string | null;
  resumeLink?: string | null;
};

type Props = {
  application: ApplicationShape | null | undefined;
  pathStrings: string[];
  selectedColor: { bg?: string; gradient?: string } | undefined;
};

export default function SubmittedDisplay({
  application,
  pathStrings,
  selectedColor,
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExportPNG() {
    if (!cardRef.current) return;
    setExporting(true);

    const ref = cardRef.current;

    try {
      const dataUrl = await (
        toPng as (
          node: HTMLElement,
          options: { pixelRatio: number },
        ) => Promise<string>
      )(ref, {
        pixelRatio: 8,
      });

      const link = document.createElement("a");
      link.download = `${application?.firstName ?? "hacker"}_hw12.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Export failed", err);
      // optionally show a toast here
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="relative m-5 mr-2 flex flex-col items-center gap-6 rounded-lg p-10 xl:flex-row">
      <div className="ml-8 flex flex-col gap-6">
        <h2 className="max-w-xl font-dico text-4xl font-semibold text-heavy">
          Your application has been submitted!
        </h2>
        <h4 className="font-figtree text-heavy">
          Thanks for applying to <b>Hack Western XII</b>,{" "}
          {application?.firstName}!
        </h4>
        <p className="font-figtree text-heavy">
          You&apos;ll hear back from us about your status in a few weeks!
        </p>
        <div>
          <Button
            variant="primary"
            onClick={handleExportPNG}
            disabled={exporting}
            className="w-64"
          >
            Share my sticker book!
            <ExternalLink />
          </Button>
        </div>
      </div>
      <div className="flex w-full justify-start lg:ml-16 lg:ml-8">
        <div
          ref={cardRef}
          className="h-80 w-80 overflow-hidden rounded-lg lg:mt-0"
          style={{
            background: `${selectedColor?.bg} 30%`,
          }}
        >
          <div className="relative h-80 w-80 rounded-lg">
            {pathStrings.length > 0 && (
              <svg className="h-80 w-80">
                {pathStrings.map((pathString, pathIndex) => (
                  <path
                    key={pathIndex}
                    d={pathString}
                    stroke={selectedColor?.gradient ?? "#a16bc7"}
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
            )}
            <div className="absolute right-4 top-1/2 z-[1000] flex -translate-y-1/2 flex-col items-end gap-4">
              <div className="-right-2 rounded-full border border-heavy px-2 py-1 font-jetbrains-mono text-xs">
                HACK WESTERN XII
              </div>
              <h1 className="z-[1000] overflow-ellipsis text-right font-dico text-3xl text-heavy">
                {`${application?.firstName ?? "Hacker"} ${application?.lastName ?? ""}`}
              </h1>
            </div>
            {application?.avatarColour && (
              <div className="absolute -top-4 left-24 -ml-8 mb-4 mr-6 h-36 w-36 scale-[0.3] self-center">
                <AvatarDisplay
                  avatarColour={application?.avatarColour}
                  avatarFace={application?.avatarFace}
                  avatarLeftHand={application?.avatarLeftHand}
                  avatarRightHand={application?.avatarRightHand}
                  avatarHat={application?.avatarHat}
                  size="lg"
                />
              </div>
            )}
            <div className="absolute -right-10 bottom-0 scale-[0.5]">
              <SchoolStamp type={application?.school} />
            </div>
            <div className="absolute bottom-4 right-24 scale-[0.7]">
              <MajorStamp type={application?.major} />
            </div>
            {application?.attendedBefore !== undefined &&
              application?.attendedBefore !== null && (
                <div className="absolute left-48 top-3 mr-1 scale-[0.85]">
                  <HWStamp
                    returning={
                      application?.attendedBefore ? "returnee" : "newcomer"
                    }
                  />
                </div>
              )}
            <div className="absolute bottom-2 scale-[0.7]">
              <HackerStamp numHackathons={application?.numOfHackathons} />
            </div>

            {application?.githubLink &&
              application?.linkedInLink &&
              application?.otherLink &&
              application?.resumeLink && (
                <div className="absolute left-6 top-8 -ml-4 scale-[0.9]">
                  <LinksStamp />
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
