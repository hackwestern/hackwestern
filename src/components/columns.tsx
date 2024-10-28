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

type AllUsersWithReviewStats = {
  userId: string;
  firstName: string | null; // nullable fields
  lastName: string | null; // nullable fields
  email: string | null; // nullable fields
  avgOriginalityRating: number;
  avgTechnicalityRating: number;
  avgPassionRating: number;
  referral: boolean;
};

export const allUsersWithReviewStatsColumns: ColumnDef<AllUsersWithReviewStats>[] =
  [
    {
      id: "rowNumber",
      header: "#",
      cell: ({ row }) => row.index + 1,
    },
    {
      accessorKey: "userId",
      header: "User ID",
    },
    {
      accessorKey: "firstName",
      header: "First Name",
    },
    {
      accessorKey: "lastName",
      header: "Last Name",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "avgOriginalityRating",
      header: "Avg Originality Rating",
      cell: ({ getValue }) => parseFloat(getValue<string>()).toFixed(2),
    },
    {
      accessorKey: "avgTechnicalityRating",
      header: "Avg Technicality Rating",
      cell: ({ getValue }) => parseFloat(getValue<string>()).toFixed(2),
    },
    {
      accessorKey: "avgPassionRating",
      header: "Avg Passion Rating",
      cell: ({ getValue }) => parseFloat(getValue<string>()).toFixed(2),
    },
    {
      accessorKey: "referral",
      header: "Referral",
      cell: ({ getValue }) => (getValue<boolean>() ? "Yes" : "No"), // Show "Yes" or "No"
    },
  ];

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
      accessorKey: "application",
      header: "Name",
      cell: ({ row }) => {
        const application: applicationType = row.getValue("application");
        return `${application?.firstName} ${application?.lastName}`;
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
        const email: string = applicant?.email;
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
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="mx-0 p-0"
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
            className="mx-0 p-0"
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
            className="mx-0 p-0"
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
            className="mx-0 p-0"
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
        return originalityRating + technicalityRating + passionRating;
      },
    },
    {
      accessorKey: "comments",
      header: "Comments",
      cell: ({ row }) => {
        const comments: string = row.getValue("comments");
        return comments;
      },
    },
  ];
