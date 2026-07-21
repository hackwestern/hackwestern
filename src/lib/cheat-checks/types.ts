import { HACKER_CHECK_TYPES, TEAM_CHECK_TYPES, TEAM_DISPLAY_CHECK_TYPES } from "./constants";

export type CheckDetail = {
    passed: boolean;
    checkedAt: Date;
    checkedbyName: string | null;
    manualOverride: boolean | null;
    notes: string | null;
}

export type HackerCheckType = (typeof HACKER_CHECK_TYPES)[number]
export type TeamCheckType = (typeof TEAM_CHECK_TYPES)[number]
export type TeamDisplayCheckType = (typeof TEAM_DISPLAY_CHECK_TYPES)[number]

//generic check type result
export type GroupedCheckResult<TCheckType extends string, TProfile> = TProfile & {
    id: string;
    checks: Partial<Record<TCheckType,CheckDetail>>;
    finalResult: boolean;
}

export type HackerProfile = {
    name: string | null;
    teamId: string | null;
    linkedin: string | null;
    github: string | null;
}

export type TeamProfile = {
    name: string | null;

}

//grouped hackers
export type GroupedHackers = GroupedCheckResult<HackerCheckType,HackerProfile>
export type GroupedTeams = GroupedCheckResult<TeamCheckType, TeamProfile>

export type DisplayTeam = {
    teamId: string;
    name: string | null;
    members: GroupedHackers[];
    checks: Partial<Record<TeamDisplayCheckType,CheckDetail>>;
    finalResult: boolean;
}