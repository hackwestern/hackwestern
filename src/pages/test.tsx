import CheatTable from "~/components/internals/Table/cheatTable"
import { sql } from 'drizzle-orm'

import { db } from "~/server/db";
import { applications, cheatCheckIndividualResults, cheatCheckTeamResults, teams, users } from '~/server/db/schema'
import { eq } from "drizzle-orm";
import { ideahub } from "googleapis/build/src/apis/ideahub";

type CheatResult = {
  userId: string
  team: string
  name: string

  isOfAge: boolean
  linkedin: string
  github: string
  githubScanner: boolean
  linkedinScanner: boolean

  ind_finalResult: boolean
  ind_notes: string | null
  ind_lastRunAt: string

  commitTime: boolean
  commitMembers: boolean
  team_registered: boolean
  team_finalResult: boolean
  team_lastRunAt: string
  team_notes: string | null
}

//clear the table when im done??

export async function getServerSideProps() {
    const id = "a989955c-156e-42a1-8ba3-dda68c0afbb3"
    //--INSERTING A TEAM-- 
    //await db.insert(teams).values({
    //     id: '000001',  // must match a real user id in your users table
    //     name: 'team 2'
    // })
    // ADDING USER TO THE TEAM
    // await db
    //     .update(users)
    //     .set({
    //         teamId:"123456",
    //     })
    //     .where(eq(users.id, id));
    // ADDING INDIVIDUAL RESULTS
    // await db.insert(cheatCheckIndividualResults).values({
    //     userId: id,  // must match a real user id in your users table
    //     isOfAge: true,
    //     githubScanner: true,
    //     linkedinScanner: false,
    //     finalResult: false,
    //     notes: 'test',
    // })
    // ADDING TEAM RESULTS
    // await db.insert(cheatCheckTeamResults).values({
    //     teamId: "000001",
    //     commitWithinAllottedTime: true,
    //     onlyTeamMemberCommits: false,
    //     devPostMembersAreRegistered: true,
    //     finalResult: false,
    //     notes: 'test',
    // })

    //FINDING USERS AND TEAMS
    // const id = await db.select().from(users).limit(5)
    // console.log(id)

    // CLEAR 
    // await db.delete(cheatCheckIndividualResults);
  const results = await db.select({
    userId: cheatCheckIndividualResults.userId,
    name: users.name,  // or whatever the name column is called
    team: teams.name,
    isOfAge: cheatCheckIndividualResults.isOfAge,
    linkedin: applications.linkedInLink,
    github: applications.githubLink,
    githubScanner: cheatCheckIndividualResults.githubScanner,
    linkedinScanner: cheatCheckIndividualResults.linkedinScanner,
    ind_finalResult: cheatCheckIndividualResults.finalResult,
    ind_lastRunAt: cheatCheckIndividualResults.lastRunAt,
    ind_notes: cheatCheckIndividualResults.notes,
    commitTime: cheatCheckTeamResults.commitWithinAllottedTime,
    commitMembers: cheatCheckTeamResults.onlyTeamMemberCommits,
    team_registered: cheatCheckTeamResults.devPostMembersAreRegistered,
    team_finalResult: cheatCheckTeamResults.finalResult,
    team_lastRunAt: cheatCheckTeamResults.lastRunAt,
    team_notes: cheatCheckTeamResults.notes,
  })
    .from(cheatCheckIndividualResults)
    .leftJoin(users, eq(cheatCheckIndividualResults.userId, users.id))
    .leftJoin(applications, eq(cheatCheckIndividualResults.userId, applications.userId))
    .leftJoin(teams, eq(teams.id,users.teamId))
    .leftJoin(cheatCheckTeamResults, eq(cheatCheckTeamResults.teamId,users.teamId))
  
  console.log(results)
  console.log("hi")
  return {
    props: { results: results.map(r => ({
      ...r,
      ind_lastRunAt: r.ind_lastRunAt.toISOString(),
      team_lastRunAt: r.team_lastRunAt.toISOString()
     })) }
  }
}

export default function Test({results}:{results: CheatResult[]}){
    return(
        <CheatTable data = {results}></CheatTable>
    )
}