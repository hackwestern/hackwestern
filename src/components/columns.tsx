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

type applicationType = {
  firstName: string;
  lastName: string;
};

export const reviewDashboardColumns: ColumnDef<typeof reviews.$inferSelect>[] =
  [
    {
      accessorKey: "applicantUserId",
      header: "Edit",
      cell: ({ row }) => {
        const userId: string = row.getValue("applicantUserId");
        return (
          <div className="text-center text-medium">
            <Link href={`./review?applicant=${userId}`}>✏️</Link>
          </div>
        );
      },
    },
    {
      accessorKey: "application",
      header: "Name",
      cell: ({ row }) => {
        const application: applicationType = row.getValue("application");
        return (
          <div className="text-left text-medium">{`${application?.firstName} ${application?.lastName}`}</div>
        );
      },
    },
    {
      accessorKey: "applicant",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="mx-0 p-0 text-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const applicant: applicantType = row.getValue("applicant");
        const email: string = applicant?.email;
        return <div className="text-left">{email}</div>;
      },
    },
    {
      accessorKey: "completed",
      header: "Completed",
      cell: ({ row }) => {
        const completed: boolean = row.getValue("completed");
        return <div className="text-center">{completed ? "✅" : "❌"}</div>;
      },
    },
    {
      accessorKey: "originalityRating",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="mx-0 p-0 text-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Originality
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    },
    {
      accessorKey: "technicalityRating",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="mx-0 p-0 text-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Technicality
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    },
    {
      accessorKey: "passionRating",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="mx-0 p-0 text-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Passion
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    },
    {
      accessorKey: "total",
      accessorFn: (row) => {
        const originalityRating = row.originalityRating ?? 0;
        const technicalityRating = row.technicalityRating ?? 0;
        const passionRating = row.passionRating ?? 0;
        return originalityRating + technicalityRating + passionRating;
      },
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="mx-0 p-0 text-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Total
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const originalityRating: number = row.getValue("originalityRating");
        const technicalityRating: number = row.getValue("technicalityRating");
        const passionRating: number = row.getValue("passionRating");
        return (
          <div className="text-center">
            {originalityRating + technicalityRating + passionRating}
          </div>
        );
      },
    },
    {
      accessorKey: "comments",
      header: "Comments",
      cell: ({ row }) => {
        const comments: string = row.getValue("comments");
        return <div className="text-left">{comments}</div>;
      },
    },
  ];
