"use client"

import { ColumnDef } from "@tanstack/react-table"
import React from "react";
import { DisplayTeam, GroupedHackers } from "~/lib/cheat-checks/types";
import CheckCell from "./checkCell";

type ColumnType = {
  header: string;
  memberCell: (member : GroupedHackers) => React.ReactNode;
  teamCell: (team : DisplayTeam) => React.ReactNode;
  width: string;
  className: string;
}

export const columns : ColumnType[] = [
  {
    header: "Name",
    memberCell: (member) => member.name,
    teamCell: () => "Team Summary",
    width: "w-[200px]",
    className: "",
  },
  {
    header: "LinkedIn/DevPost",
    memberCell: (member) => member.linkedin ? <a
          href={member.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline"
        >
          LinkedIn
        </a> : "",
    teamCell: (team) => team.devPost ? <a
          href={team.devPost}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline"
        >
          devPost
        </a> : "",
    width: "w-[100px] truncate",
    className: "text-center",
  },
  {
    header: "GitHub",
    memberCell: (member) => member.github ? <a
          href={member.github}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline"
        >
          GitHub
        </a> : "",
    teamCell: (team) => team.github ? <a
          href={team.github}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline"
        >
          GitHub
        </a> : "",
    width: "w-[100px] truncate",
    className: "text-center",
  },
  {
    header: "ofAge?",
    memberCell: (member) => <CheckCell 
      check={member.checks.IS_OF_AGE}
    />,
    teamCell: (team) => team.checks.IS_OF_AGE?.passed ? "✓" : "✗",
    width: "w-[70px]",
    className: "text-center",
  },
  {
    header: "Registered?",
    memberCell: (member) => <CheckCell 
      check={member.checks.IS_REGISTERED}
    />,
    teamCell: (team) => team.checks.IS_REGISTERED?.passed ? "✓" : "✗",
    width: "w-[100px]",
    className: "text-center",
  },
  {
    header: "Commit Within Time",
    memberCell: () => "",
    teamCell: (team) => <CheckCell 
      check={team.checks.COMMIT_WITHIN_ALLOTTED_TIME}
    />,
    width: "w-[100px]",
    className: "text-center",
  },
  {
    header: "Dev Registered?",
    memberCell: () => "",
    teamCell: (team) => <CheckCell 
      check={team.checks.DEVPOST_MEMBERS_REGISTERED}
    />,
    width: "w-[100px]",
    className: "text-center",
  },
  {
    header: "Only Team Commits?",
    memberCell: () => "",
    teamCell: (team) => <CheckCell 
      check={team.checks.ONLY_TEAM_MEMBER_COMMITS}
    />,
    width: "w-[100px]",
    className: "text-center",
  },
  {
    header: "Final Verdict",
    memberCell: (member) => member.finalResult ? "PASSED" : "FAILED",
    teamCell: (team) => team.finalResult ? "PASSED" : "FAILED",
    width: "w-[100px]",
    className: "text-center",
  },
]