import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import Link from "next/link";
import { reviews } from "~/server/db/schema";
import { Button } from "./ui/button";


type applicantType = {
  email: string,
  id: string,
  name: string,
}

export const reviewDashboardColumns: ColumnDef<typeof reviews.$inferSelect>[] = [
    {
      accessorKey: "applicantUserId",
      header: "Edit",
      cell: ({ row }) => {
        const userId: string = row.getValue("applicantUserId")
        return <Link href={`./review?applicant=${userId}`}>✏️</Link>
      }
    },
    {
      accessorKey: "applicant",
      header: "Name",
      cell: ({ row }) => {
        const applicant: applicantType = row.getValue("applicant")
        const name: string = applicant.name
        return <div>{name}</div>
      }
    },
    {
      accessorKey: "applicant",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const applicant: applicantType = row.getValue("applicant")
        const email: string = applicant.email
        return <div>{email}</div>
      }
    },
    {
      accessorKey: "completed",
      header: "Completed",
      cell: ({ row }) => {
        const completed: boolean = row.getValue("completed")
        return completed ? "✅" : "❌"
      }
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
      cell: ({ row }) => {
        const completed: boolean = row.getValue("referral")
        return completed ? "🤝" : ""
      }
    },
  ];