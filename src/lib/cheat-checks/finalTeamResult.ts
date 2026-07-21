import { TEAM_DISPLAY_CHECK_TYPES } from "./constants";
import { GroupResults } from "./groupResults";
import { GroupedHackers, GroupedTeams, HackerCheckType, TeamCheckType, DisplayTeam } from "./types";

function CalculateResult(
    members: GroupedHackers[],
    checkType: HackerCheckType,
){
    const result = members.every((member) => {
        const check = member.checks[checkType];
        return check?.manualOverride ?? check?.passed ?? false;
    })

    return {
        passed: result,
        checkedAt: new Date(),
        checkedbyName: null,
        manualOverride: null,
        notes: null,
    }
}

export function TeamResults(
    groupedHackers: GroupedHackers[],
    teams: GroupedTeams[],
): DisplayTeam[] {
    const team = new Map<string, GroupedHackers[]>();
    for (const hacker of groupedHackers){
        const teamId = hacker.teamId ?? "no-team";
        if (!team.has(teamId)) team.set(teamId, []);
        team.get(teamId)!.push(hacker);
    }

    const teamChecks = new Map(teams.map((t) => [t.id, t] as const));
    const allTeamIds = new Set(...team.keys(), ...teamChecks.keys());

    return Array.from(allTeamIds).map((teamId) => {
        const members = team.get(teamId) ?? [];
        const teamEntry = teamChecks.get(teamId);

        const summary = {
            IS_OF_AGE: CalculateResult(members,"IS_OF_AGE"),
            IS_REGISTERED: CalculateResult(members, "IS_REGISTERED"),
        };

        const checks: DisplayTeam["checks"] = {
            ...summary,
            ...teamEntry?.checks ?? {}
        };

        const finalResult = TEAM_DISPLAY_CHECK_TYPES.every((type) => checks[type]?.passed ?? false)

        return {
            teamId: teamId,
            name: teamEntry?.name ?? null,
            members,
            checks,
            finalResult,
        }

    })


}