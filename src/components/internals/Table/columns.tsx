"use client"

import { ColumnDef } from "@tanstack/react-table"
import React from "react";
import { DisplayTeam, GroupedHackers } from "~/lib/cheat-checks/types";

type ColumnType = {
  header: string;
  memberCell: (member : GroupedHackers) => React.ReactNode;
  teamCell: (team : DisplayTeam) => React.ReactNode;
}

export const columns : ColumnType[] = [
  {
    header: "Name",
    memberCell: (member) => member.name,
    teamCell: () => "Team Summary",
  },
  {
    header: "AgeCheck",
    memberCell: (member) => member.checks.IS_OF_AGE?.passed ? "TRUE" : "FALSE",
    teamCell: (team) => team.checks.IS_OF_AGE?.passed ? "TRUE" : "FALSE",
  },
  {
    header: "isRegistered",
    memberCell: (member) => member.checks.IS_REGISTERED?.passed ? "TRUE" : "FALSE",
    teamCell: (team) => team.checks.IS_REGISTERED?.passed ? "TRUE" : "FALSE",
  },
  {
    header: "commit-within-time",
    memberCell: () => "",
    teamCell: (team) => team.checks.COMMIT_WITHIN_ALLOTTED_TIME?.passed ? "TRUE" : "FALSE",
  },
  {
    header: "DevpostRegistered",
    memberCell: () => "",
    teamCell: (team) => team.checks.DEVPOST_MEMBERS_REGISTERED?.passed ? "TRUE" : "FALSE",
  },
  {
    header: "team-commits-only",
    memberCell: () => "",
    teamCell: (team) => team.checks.ONLY_TEAM_MEMBER_COMMITS?.passed ? "TRUE" : "FALSE",
  },
  // {
  //   header: "Last Run At",
  //   cell: 
  // },
  {
    header: "Final Verdict",
    memberCell: (member) => member.finalResult ? "TRUE" : "FALSE",
    teamCell: (team) => team.finalResult ? "TRUE" : "FALSE",
  },
  // {
  //   header: "Notes",
  //   cell: (_member, team) => team.
  // },
]