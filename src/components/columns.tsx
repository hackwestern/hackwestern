import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";

type ReviewWithRelations = {
  reviewerUserId: string;
  applicantUserId: string;
  createdAt: Date;
  updatedAt: Date;
  originalityRating: number | null;
  technicalityRating: number | null;
  passionRating: number | null;
  comments: string | null;
  completed: boolean;
  referral: boolean;
  applicant: {
    id: string;
    email: string;
  };
  application: {
    firstName: string | null;
    lastName: string | null;
  };
};

export const reviewDashboardColumns: ColumnDef<ReviewWithRelations>[] = [
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
    enableSorting: false,
  },
  {
    accessorFn: (row) =>
      `${row.application?.firstName} ${row.application?.lastName}`,
    id: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="mx-0 p-0 text-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const application = row.original.application;
      return (
        <div className="text-left text-medium">{`${application?.firstName} ${application?.lastName}`}</div>
      );
    },
  },
  {
    accessorFn: (row) => row.applicant?.email,
    id: "email",
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
      const applicant = row.original.applicant;
      const email: string = applicant?.email;
      return <div className="text-left">{email}</div>;
    },
  },
  {
    accessorKey: "completed",
    header: "Completed",
    enableSorting: false,
    cell: ({ row }) => {
      const completed: boolean = row.getValue("completed");
      return <div className="text-center">{completed ? "✅" : "❌"}</div>;
    },
  },
  {
    accessorKey: "originalityRating",
    sortDescFirst: false,
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
    cell: ({ row }) => {
      const rating: number = row.getValue("originalityRating") ?? 0;
      return <div className="text-center">{rating}</div>;
    },
  },
  {
    accessorKey: "technicalityRating",
    sortDescFirst: false,
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
    cell: ({ row }) => {
      const rating: number = row.getValue("technicalityRating") ?? 0;
      return <div className="text-center">{rating}</div>;
    },
  },
  {
    accessorKey: "passionRating",
    sortDescFirst: false,
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
    cell: ({ row }) => {
      const rating: number = row.getValue("passionRating") ?? 0;
      return <div className="text-center">{rating}</div>;
    },
  },
  {
    accessorFn: (row) => {
      const originalityRating = row.originalityRating ?? 0;
      const technicalityRating = row.technicalityRating ?? 0;
      const passionRating = row.passionRating ?? 0;
      return originalityRating + technicalityRating + passionRating;
    },
    id: "total",
    sortDescFirst: false,
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
      const originalityRating: number = row.getValue("originalityRating") ?? 0;
      const technicalityRating: number =
        row.getValue("technicalityRating") ?? 0;
      const passionRating: number = row.getValue("passionRating") ?? 0;
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
    enableSorting: false,
    cell: ({ row }) => {
      const comments: string = row.getValue("comments") ?? "";
      return <div className="text-left">{comments}</div>;
    },
  },
];
