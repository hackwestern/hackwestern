/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import type { major, numOfHackathons } from "~/server/db/schema";
import { schools } from "~/constants/schools";

type majorType = (typeof major.enumValues)[number];
type schoolType = (typeof schools)[number];
type experienceType = (typeof numOfHackathons.enumValues)[number];

const majorMap = (type: majorType | undefined | null): string | undefined => {
  switch (type) {
    case "Computer Science":
      return "/stamps/major/cs.svg";
    case "Computer Engineering":
      return "/stamps/major/compeng.svg";
    case "Software Engineering":
      return "/stamps/major/swe.svg";
    case "Other Engineering Discipline":
      return "/stamps/major/eng.svg";
    case "Information Systems":
      return "/stamps/major/infosys.svg";
    case "Information Technology":
      return "/stamps/major/infotech.svg";
    case "System Administration":
      return "/stamps/major/sysadmin.svg";
    case "Natural Sciences (Biology, Chemistry, Physics, etc.)":
      return "/stamps/major/natsci.svg";
    case "Mathematics/Statistics":
      return "/stamps/major/math.svg";
    case "Web Development/Web Design":
      return "/stamps/major/webdev.svg";
    case "Business Administration":
      return "/stamps/major/bus.svg";
    case "Humanities":
      return "/stamps/major/socsci.svg";
    case "Social Science":
      return "/stamps/major/socsci.svg";
    case "Fine Arts/Performing Arts":
      return "/stamps/major/perfarts.svg";
    case "Other":
    default:
      return undefined;
  }
};

const schoolMap = (
  school: schoolType | undefined | null,
): string | undefined => {
  switch (school) {
    case "Western University":
      return "/stamps/schools/uwo.svg";
    case "University of Waterloo":
      return "/stamps/schools/uw.svg";
    case "McMaster University":
      return "/stamps/schools/mac.svg";
    case "York University":
      return "/stamps/schools/york.svg";
    case "University of Toronto":
      return "/stamps/schools/uoft.svg";
    case "University of Toronto Mississauga":
      return "/stamps/schools/utm.svg";
    case "University of Toronto Scarborough":
      return "/stamps/schools/utsc.svg";
    case "Wilfrid Laurier University":
      return "/stamps/schools/laurier.svg";
    case "Other":
    default:
      return "/stamps/schools/other.svg";
  }
};

const experienceMap = (
  experience: experienceType | undefined | null,
): string | undefined => {
  switch (experience) {
    case "0":
      return "/stamps/experience/0.svg";
    case "1-3":
      return "/stamps/experience/1-3.svg";
    case "4-6":
      return "/stamps/experience/4-6.svg";
    case "7+":
      return "/stamps/experience/7.svg";
    default:
      return undefined;
  }
};

const sharedStampClass = "h-16 sm:h-20 2xl:h-28 3xl:h-32 4xl:h-36";

export function MajorStamp({
  type,
}: {
  type?: majorType | null;
}): React.ReactElement | null {
  if (!type) return null;
  const stampSrc = majorMap(type);
  if (!stampSrc) return null;
  return (
    <img
      alt="Field of Study Stamp"
      src={stampSrc}
      className={`${sharedStampClass} rotate-[2.1deg]`}
    />
  );
}

export function HWStamp({
  returning,
}: {
  returning: "newcomer" | "returnee";
}): React.ReactElement {
  const stampSrc = `/stamps/returning/${returning}.svg`;
  return (
    <img
      alt="Hack Western Experience Stamp"
      src={stampSrc}
      className={`${sharedStampClass} rotate-[2.25deg]`}
    />
  );
}

export function SchoolStamp({
  type,
}: {
  type?: string | null;
}): React.ReactElement | null {
  // allowed school literals before using the typed schoolMap helper.
  if (!type) return null;
  // runtime-guard: only accept values present in the `schools` list
  if (!schools.includes(type as schoolType)) return null;
  const stampSrc = schoolMap(type as schoolType);
  if (!stampSrc) return null;
  return (
    <img
      alt="School Stamp"
      src={stampSrc}
      className={`${sharedStampClass} rotate-[-3.35deg]`}
    />
  );
}

export function HackerStamp({
  numHackathons,
}: {
  numHackathons?: experienceType | null;
}): React.ReactElement | null {
  if (!numHackathons) return null;
  const stampSrc = experienceMap(numHackathons);
  if (!stampSrc) return null;
  return (
    <img
      alt="Hackathon Experience Stamp"
      src={stampSrc}
      className={`${sharedStampClass} rotate-[-1.8deg]`}
    />
  );
}

export function SubmittedStamp(): React.ReactElement {
  return (
    <img
      alt="Submitted Stamp"
      src="/stamps/completion/submitted.svg"
      className={`${sharedStampClass}`}
    />
  );
}

export function LinksStamp(): React.ReactElement {
  return (
    <img
      alt="Links Added Stamp"
      src="/stamps/completion/linked.svg"
      className={`${sharedStampClass} rotate-[2.13deg]`}
    />
  );
}

interface StampContainerProps {
  step: string | null;
  data: {
    major?: majorType;
    school?: schoolType;
    numOfHackathons?: experienceType;
    attendedBefore?: boolean;
    githubLink?: string | null;
    linkedInLink?: string | null;
    otherLink?: string | null;
    resumeLink?: string | null;
    status?: string;
  };
}

export function StampContainer({ step, data }: StampContainerProps) {
  const showMajorStamp = data?.major;
  const showSchoolStamp = data?.school;
  const showHackerStamp = data?.numOfHackathons;
  const showHWStamp = data?.attendedBefore !== undefined;
  const showLinksStamp =
    data?.githubLink &&
    data?.linkedInLink &&
    data?.otherLink &&
    data?.resumeLink;
  const showSubmittedStamp =
    step === "review" && data?.status !== "IN_PROGRESS";

  return (
    <div className="pointer-events-none pointer-events-none absolute inset-0 z-40 md:flex">
      {showMajorStamp && (
        <div className="absolute left-80 top-20">
          <MajorStamp type={data.major} />
        </div>
      )}
      {showSchoolStamp && (
        <div className="absolute right-8 top-32">
          <SchoolStamp type={data.school} />
        </div>
      )}
      {showHackerStamp && (
        <div className="absolute bottom-40 right-12">
          <HackerStamp numHackathons={data.numOfHackathons} />
        </div>
      )}
      {showHWStamp && (
        <div className="absolute bottom-20 left-80">
          <HWStamp returning={data?.attendedBefore ? "returnee" : "newcomer"} />
        </div>
      )}
      {showLinksStamp && (
        <div className="transform-translate-y-10 absolute right-16 top-1/4">
          <LinksStamp />
        </div>
      )}
      {showSubmittedStamp && (
        <div className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 transform">
          <SubmittedStamp />
        </div>
      )}
    </div>
  );
}
