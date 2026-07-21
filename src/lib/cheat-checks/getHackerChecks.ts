import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "~/server/db";
import { applications, hackerCheckResults, users } from "~/server/db/schema";

const reviewers = alias(users,"reviewers");

export async function getHackerCheckRows(){
    return db
        .select({
            id: hackerCheckResults.userId,
            passed: hackerCheckResults.passed,
            checkType: hackerCheckResults.checkType,
            checkedAt: hackerCheckResults.checkedAt,
            checkedbyName: reviewers.name,
            manualOverride: hackerCheckResults.manualOverride,
            notes: hackerCheckResults.notes,

            name: users.name,
            teamId: users.teamId,
            linkedin: applications.linkedInLink,
            github: applications.githubLink,
        })
        .from(hackerCheckResults)
        .leftJoin(users, eq(hackerCheckResults.userId, users.id))
        .leftJoin(applications, eq(hackerCheckResults.userId, applications.userId))
        .leftJoin(reviewers, eq(hackerCheckResults.checkedByUserId, reviewers.id))
}