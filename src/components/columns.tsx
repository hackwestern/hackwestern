import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink } from "lucide-react";
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

// Type for rankings data
type RankingsApplicationType = {
  userId: string;
  name: string;
  email: string;
  school: string | null;
  levelOfStudy: string | null;
  major: string | null;
  gender: string | null;
  resumeLink: string | null;
  githubLink: string | null;
  linkedInLink: string | null;
  otherLink: string | null;
  status: string;
  createdAt: Date;
  // Review scores
  totalReviews: number;
  avgOriginality: number;
  avgTechnicality: number;
  avgPassion: number;
  totalScore: number;
  avgScore: number;
  avgScorePerReview: number;
  originalRank?: number;
  rank?: number;
  quotaStatus?: string;
  weightedScore?: number;
};

export const rankingsColumns: ColumnDef<RankingsApplicationType>[] = [
  {
    accessorKey: "rank",
    header: "Rank",
    cell: ({ row }) => {
      const rank =
        row.original.rank ?? row.original.originalRank ?? row.index + 1;
      const quotaStatus = row.original.quotaStatus;

      return (
        <div className="text-center text-lg font-bold">
          {quotaStatus === "quota_exceeded" ? (
            <span className="text-red-500 line-through">#{rank}</span>
          ) : quotaStatus === "promoted" ? (
            <span className="font-bold text-blue-600">#{rank}</span>
          ) : quotaStatus === "promoted_extra" ? (
            <span className="text-blue-600">#{rank}</span>
          ) : rank <= 400 ? (
            <span className="text-green-600">#{rank}</span>
          ) : (
            <span className="text-gray-500">#{rank}</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const name: string = row.getValue("name");
      const userId: string = row.original.userId;
      const quotaStatus = row.original.quotaStatus;

      return (
        <div className="flex items-center gap-2">
          <Link
            href={`/internal/review?applicant=${userId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer text-left font-medium text-black transition-colors hover:text-purple-600"
          >
            {name}
          </Link>
          {quotaStatus === "promoted" && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
              Promoted
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => {
      const email: string = row.getValue("email");
      return <div className="text-left">{email}</div>;
    },
  },
  {
    accessorKey: "school",
    header: "School",
    cell: ({ row }) => {
      const school: string | null = row.getValue("school");
      return <div className="text-left">{school ?? "—"}</div>;
    },
  },
  {
    accessorKey: "gender",
    header: "Gender",
    cell: ({ row }) => {
      const gender: string | null = row.getValue("gender");
      return <div className="text-left">{gender ?? "—"}</div>;
    },
  },
  {
    accessorKey: "avgOriginality",
    header: "Originality",
    cell: ({ row }) => {
      const score: number = row.getValue("avgOriginality");
      return <div className="text-center font-medium">{score.toFixed(1)}</div>;
    },
  },
  {
    accessorKey: "avgTechnicality",
    header: "Technicality",
    cell: ({ row }) => {
      const score: number = row.getValue("avgTechnicality");
      return <div className="text-center font-medium">{score.toFixed(1)}</div>;
    },
  },
  {
    accessorKey: "avgPassion",
    header: "Passion",
    cell: ({ row }) => {
      const score: number = row.getValue("avgPassion");
      return <div className="text-center font-medium">{score.toFixed(1)}</div>;
    },
  },
  {
    accessorKey: "totalScore",
    header: "Total Score",
    cell: ({ row }) => {
      const score: number = row.getValue("totalScore");
      return <div className="text-center text-lg font-bold">{score}</div>;
    },
  },
  {
    accessorKey: "avgScorePerReview",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="mx-0 p-0 text-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Avg Score/Review
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const score: number = row.getValue("avgScorePerReview");
      return (
        <div className="text-center text-lg font-bold text-purple-600">
          {score.toFixed(1)}
        </div>
      );
    },
  },
  {
    accessorKey: "weightedScore",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="mx-0 p-0 text-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Weighted Score
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const score: number = row.getValue("weightedScore");
      return (
        <div className="text-center text-lg font-bold text-orange-600">
          {score.toFixed(1)}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status: string = row.getValue("status");
      const statusColors = {
        PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
        IN_REVIEW: "bg-blue-100 text-blue-800",
        ACCEPTED: "bg-green-100 text-green-800",
        REJECTED: "bg-red-100 text-red-800",
        WAITLISTED: "bg-orange-100 text-orange-800",
      };
      const colorClass =
        statusColors[status as keyof typeof statusColors] ||
        "bg-gray-100 text-gray-800";

      return (
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colorClass}`}
        >
          {status.replace("_", " ")}
        </span>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Applied",
    cell: ({ row }) => {
      const date: Date = row.getValue("createdAt");
      return (
        <div className="text-left text-sm">{date.toLocaleDateString()}</div>
      );
    },
  },
];
