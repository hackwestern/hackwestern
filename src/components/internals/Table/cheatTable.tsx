import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"

import { columns } from "./columns"
import { DisplayTeam, GroupedHackers, HackerCheckType, TeamDisplayCheckType } from "~/lib/cheat-checks/types";
import { Fragment } from "react";

type CheatTableProps = {
  final_data: DisplayTeam[];
};

export default function CheatTable( {final_data}:CheatTableProps ){
    console.log(final_data[0]?.members)
//SET TABLE VISIBILITIES?
    return(
        <>
        <Table>
            <TableCaption>Cheat Check Summary</TableCaption>
            <TableHeader>
                <TableRow>
                    <TableHead> Team </TableHead>
                    {columns
                    .map((col) => (
                        <TableHead>{col.header}</TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                    
                    {final_data.map((team) => (
                        <Fragment key={team.teamId}>
                            <TableRow key={team.teamId}>
                                <TableCell rowSpan={team.members.length + 1}>
                                        {team.name}
                                </TableCell>
                            {columns.map((col) => (
                                <TableCell key={col.header}>
                                    {col.teamCell(team)}
                                </TableCell>
                            ))}
                            </TableRow>

                        {team.members.map((member) => (
                            <TableRow key = {member.id}>
                                {columns.map((col) => (
                                    <TableCell key={col.header}>{col.memberCell(member)}</TableCell>
                                ))}
                            </TableRow>
                       ))}
                                
                        </Fragment>
                    )
                    )}
            </TableBody>
        </Table>
        </>
    )
}
