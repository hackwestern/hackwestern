import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { teamCheckResults, teams, users } from "~/server/db/schema";

export async function getTeamCheckRows(){
    return db
        .select({
            id: teamCheckResults.id,
            passed: teamCheckResults.passed,
            checkType: teamCheckResults.checkType,
            checkedAt: teamCheckResults.checkedAt,
            checkedbyName: users.name,
            manualOverride: teamCheckResults.manualOverride,
            notes: teamCheckResults.notes,

            name: teams.name,
        })
        .from(teamCheckResults)
        .leftJoin(users, eq(teamCheckResults.checkedByUserId, users.id))
        .leftJoin(teams, eq(teamCheckResults.teamId,teams.id))
}