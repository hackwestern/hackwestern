"use client"

import { ColumnDef } from "@tanstack/react-table"

export type Ind_CheatResult = {
//   kind: 'individual'
  userId: string
  teamId: string
  team: string
  name: string

  isOfAge: boolean
  linkedin: string
  github: string
  githubScanner: boolean
  linkedinScanner: boolean

  finalResult: boolean
  notes: string | null
  lastRunAt: string
}

export type Team_CheatResult = Ind_CheatResult & {
//   kind: 'team'
  commitTime: boolean
  commitMembers: boolean
  team_registered: boolean
}

export const columns = [
{
    accessorKey: "team",
    header: "Team",
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "isOfAge",
    header: "Age",
    format: (v: boolean) => v ? "TRUE" : "FALSE"
  },
  {
    accessorKey: "linkedin",
    header: "LinkedIn",
  },
  {
    accessorKey: "github",
    header: "Github",
  },
  {
    accessorKey: "linkedinScanner",
    header: "LinkedIn Scanner",
    format: (v: boolean) => v ? "TRUE" : "FALSE"
  },
  {
    accessorKey: "githubScanner",
    header: "Github Scanner",
    format: (v: boolean) => v ? "TRUE" : "FALSE"
  },
  {
    accessorKey: "commitTime",
    header: "Commit Time",
    format: (v: boolean) => v ? "TRUE" : "FALSE"
  },
  {
    accessorKey: "commitMembers",
    header: "Commit Members",
    format: (v: boolean) => v ? "TRUE" : "FALSE"
  },
  {
    accessorKey: "registered",
    header: "Team Registered",
    format: (v: boolean) => v ? "TRUE" : "FALSE"
  },
  {
    accessorKey: "lastRunAt",
    header: "Last Run At",
  },
  {
    accessorKey: "finalResult",
    header: "Final Verdict",
    format: (v: boolean) => v ? "TRUE" : "FALSE"
  },
  {
    accessorKey: "notes",
    header: "Notes",
  },
]