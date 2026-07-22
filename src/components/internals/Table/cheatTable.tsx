import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"

//make expanding animation smoother

import { columns } from "./columns"
import { DisplayTeam, GroupedHackers, HackerCheckType, TeamDisplayCheckType } from "~/lib/cheat-checks/types";
import { Fragment, useState } from "react";

type CheatTableProps = {
  final_data: DisplayTeam[];
};

export default function CheatTable( {final_data}:CheatTableProps ){
    
    const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

    const toggleTeam = (teamId: string) => {
        setExpandedTeams((prev) => {
            const next = new Set(prev);

            if (next.has(teamId)) {
                next.delete(teamId);
            }else {
                next.add(teamId);
            }

            return next
        })
    }
//SET TABLE VISIBILITIES?
    return(
        <>
        <Table className="table-fixed [&_tr]:border-blue-8">
            <TableCaption>Cheat Check Summary</TableCaption>
            <TableHeader>
                <TableRow >
                    <TableHead> Team </TableHead>
                    {columns
                    .map((col) => (
                        <TableHead className={col.width}>{col.header}</TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody >
                    
                    {final_data.map((team) => (
                        <Fragment key={team.teamId}>
                            <TableRow key={team.teamId}
                            onClick={() => toggleTeam(team.teamId)}
                            className="cursor-pointer">
                                <TableCell rowSpan={
                                    expandedTeams.has(team.teamId)
                                        ? team.members.length + 1
                                        : 1
                                }
                                className="align-top">
                                        {expandedTeams.has(team.teamId) ? "▼" : "▶"} {team.name}
                                </TableCell>
                            {columns.map((col) => (
                                <TableCell key={col.header} className={`${col.header == "Name" && "font-bold"} ${col.className}`}>
                                    {col.teamCell(team)}
                                </TableCell>
                            ))}
                            </TableRow>
                        
                        {expandedTeams.has(team.teamId) && (
                            <>
                        {team.members.map((member) => (
                            <TableRow key = {member.id}>
                                {columns.map((col) => (
                                    <TableCell key={col.header} className={col.className}>{col.memberCell(member)}</TableCell>
                                ))}
                            </TableRow>
                       ))}
                       </>)}
                                
                        </Fragment>
                    )
                    )}
            </TableBody>
        </Table>
        </>
    )
}
