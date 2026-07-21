import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"

import { Ind_CheatResult, Team_CheatResult, columns } from "./columns"

interface CheatTableProps{
    ind_data: Ind_CheatResult[];
    team_data: Team_CheatResult[];
}
export default function CheatTable( {ind_data, team_data}:CheatTableProps ){
 
    const grouped = ind_data.reduce((acc, row) => {
        const existing = acc.find(g => g.teamId == row.teamId);
        if (existing) existing.members.push(row);
        else acc.push({teamId: row.teamId, members:[row]})
        return acc
    }, [] as {teamId: string, members:Ind_CheatResult[]}[])

    grouped.forEach(group => {
        const teamRow = team_data.find(t => t.teamId == group.teamId)
        if (teamRow) group.members.push(teamRow)
    })
    

//SET TABLE VISIBILITIES?
    return(
        <>
        <Table>
            <TableCaption>Cheat Check Summary</TableCaption>
            <TableHeader>
                <TableRow>
                    {columns
                    .map((col) => (
                        <TableHead>{col.header}</TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                    
                    {grouped.map((group) => (
                        <>
                        {group.members.map((member, index) => (
                            <TableRow key = {member.userId}>
                                {index === 0 && (
                                    <TableCell rowSpan={group.members.length}>
                                        {member.team}
                                    </TableCell>
                                )}
                                {columns
                                .filter(col => col.accessorKey !== 'team')
                                
                                .map(col => {
                                    //add checks for ind vs team cheat result type?
                                    const value = member[col.accessorKey as keyof Ind_CheatResult]
                                    return (
                                    <TableCell key = {col.accessorKey}>
                                        {value !== undefined ?
                                        (col.format ? col.format(value as boolean) : value)
                                        : ""}
                                    </TableCell>
                                    )
                                })}
                            </TableRow>
                       ))}        
                        </>
                    )
                    )}
            </TableBody>
        </Table>
        </>
    )
}
