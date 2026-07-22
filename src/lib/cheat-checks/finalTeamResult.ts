import { TEAM_DISPLAY_CHECK_TYPES } from "./constants";
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
    const allTeams = new Map<string, GroupedHackers[]>();
    for (const hacker of groupedHackers){
        const teamId = hacker.teamId ?? "no-team";
        if (!allTeams.has(teamId)) allTeams.set(teamId, []);
        allTeams.get(teamId)!.push(hacker);
    }

    const teamChecks = new Map(teams.map((t) => [t.id, t] as const));
    const allTeamIds = new Set([...allTeams.keys(), ...teamChecks.keys()]);
    return Array.from(allTeamIds).map((teamId) => {
        const members = allTeams.get(teamId) ?? [];
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
            members: members,
            checks: checks,
            finalResult: finalResult,
        }

    })


}