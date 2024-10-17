import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import Link from "next/link";
import type { reviews } from "~/server/db/schema";
import { Button } from "./ui/button";

type applicantType = {
  email: string;
  id: string;
  name: string;
};

export const reviewDashboardColumns: ColumnDef<typeof reviews.$inferSelect>[] =
  [
    {
      accessorKey: "applicantUserId",
      header: "Edit",
      cell: ({ row }) => {
        const userId: string = row.getValue("applicantUserId");
        return <Link href={`./review?applicant=${userId}`}>✏️</Link>;
      },
    },
    {
      accessorKey: "applicant",
      header: "Name",
      cell: ({ row }) => {
        const applicant: applicantType = row.getValue("applicant");
        const name: string = applicant.name;
        return name;
      },
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
        );
      },
      cell: ({ row }) => {
        const applicant: applicantType = row.getValue("applicant");
        const email: string = applicant.email;
        return email;
      },
    },
    {
      accessorKey: "completed",
      header: "Completed",
      cell: ({ row }) => {
        const completed: boolean = row.getValue("completed");
        return completed ? "✅" : "❌";
      },
    },
    {
      accessorKey: "originalityRating",
      header: "Originality",
    },
    {
      accessorKey: "technicalityRating",
      header: "Technicality",
    },
    {
      accessorKey: "passionRating",
      header: "Passion",
    },
    {
      accessorKey: "referral",
      header: "Referral",
      cell: ({ row }) => {
        const completed: boolean = row.getValue("referral");
        return completed ? "🤝" : "";
      },
    },
  ];
