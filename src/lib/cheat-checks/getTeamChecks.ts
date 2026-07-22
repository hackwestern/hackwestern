import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { teamCheckResults, teams, users } from "~/server/db/schema";

export async function getTeamCheckRows(){
    return db
        .select({
            id: teamCheckResults.teamId,
            passed: teamCheckResults.passed,
            checkType: teamCheckResults.checkType,
            checkedAt: teamCheckResults.checkedAt,
            checkedbyName: users.name,
            manualOverride: teamCheckResults.manualOverride,
            notes: teamCheckResults.notes,

            name: teams.name,
            devPost: teams.devpostUrl,
            github: teams.githubUrl,
        })
        .from(teamCheckResults)
        .leftJoin(users, eq(teamCheckResults.checkedByUserId, users.id))
        .leftJoin(teams, eq(teamCheckResults.teamId,teams.id))
}