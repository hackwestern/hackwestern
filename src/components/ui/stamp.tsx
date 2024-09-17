import * as React from "react";
import { major, numOfHackathons } from "~/server/db/schema";
import { schools } from "~/constants/schools";

type majorType = (typeof major.enumValues)[number];
type schoolType = (typeof schools)[number];
type experienceType = (typeof numOfHackathons.enumValues)[number];

const sizes = {
  sm: "h-10",
  md: "h-20",
  lg: "h-30",
};

const majorMap = (type: majorType): string => {
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
      return "";
  }
};

const schoolMap = (school: schoolType): string => {
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

const experienceMap = (experience: experienceType): string => {
  switch (experience) {
    case "0":
      return "/stamps/experience/0.svg";
    case "1-3":
      return "/stamps/experience/1-3.svg";
    case "4-6":
      return "/stamps/experience/4-6.svg";
    case "7+":
      return "/stamps/experience/7.svg";
  }
};

export function MajorStamp({ type }: { type: majorType }) {
  const stampSrc = majorMap(type);
  if (!stampSrc) return "";
  return <img alt="Field of Study Stamp" src={stampSrc} className="h-20"></img>;
}

export function HWStamp({ returning }: { returning: "newcomer" | "returnee" }) {
  const stampSrc = `/stamps/returning/${returning}.svg`;
  return (
    <img
      alt="Hack Western Experience Stamp"
      src={stampSrc}
      className="h-20"
    ></img>
  );
}

export function SchoolStamp({ type }: { type: schoolType }) {
  const stampSrc = schoolMap(type);
  if (!stampSrc) return "";
  return <img alt="School Stamp" src={stampSrc} className="h-20"></img>;
}

export function HackerStamp({
  numHackathons,
}: {
  numHackathons: experienceType;
}) {
  const stampSrc = experienceMap(numHackathons);
  return (
    <img alt="Hackathon Experience Stamp" src={stampSrc} className="h-20"></img>
  );
}

export function SubmittedStamp() {
  return (
    <img
      alt="Submitted Stamp"
      src="/stamps/completion/submitted.svg"
      className="h-20"
    ></img>
  );
}

export function LinksStamp() {
  return (
    <img
      alt="Links Added Stamp"
      src="/stamps/completion/linked.svg"
      className="h-20"
    ></img>
  );
}
