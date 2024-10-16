import { ColumnDef } from "@tanstack/react-table"
import Link from "next/link";
import { reviews } from "~/server/db/schema";

export const reviewDashboardColumns: ColumnDef<typeof reviews.$inferSelect>[] = [
    {
      accessorKey: "applicantUserId",
      header: "user_id",
      cell: ({ row }) => {
        const userId: string = row.getValue("applicantUserId")
        return <Link className="underline" href={`./review?applicant=${userId}`}>{userId}</Link>
      }
    },
    {
      accessorKey: "completed",
      header: "completed",
    },
    {
      accessorKey: "question1Rating",
      header: "Q1",
    },
    {
      accessorKey: "question2Rating",
      header: "Q2",
    },
    {
      accessorKey: "question3Rating",
      header: "Q3",
    },
    {
      accessorKey: "referral",
      header: "Referral",
    },
  ];