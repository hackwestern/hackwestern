import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { db } from "~/server/db";
import { authOptions } from "~/server/auth";
import { api } from "~/utils/api";
import { DataTable } from "~/components/ui/data-table";
import { rankingsColumns } from "~/components/columns";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import CanvasBackground from "~/components/canvas-background";
import { Input } from "~/components/ui/input";
import { useState } from "react";
import { RefreshCw, X } from "lucide-react";

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
  });

  if (user?.type !== "organizer") {
    return {
      redirect: {
        destination: "/dashboard",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
}

const Rankings = () => {
  const { data: rankingsData, isLoading, refetch } = api.application.getAllForRankings.useQuery(undefined, {
    enabled: false, // Don't fetch on page load
  });
  const [search, setSearch] = useState("");

  const filteredData = rankingsData?.map((application, index) => ({
    ...application,
    originalRank: index + 1
  }))?.filter((application) => {
    return (
      application.email.toLowerCase().includes(search.toLowerCase()) ||
      application.name.toLowerCase().includes(search.toLowerCase()) ||
      (application.school?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (application.major?.toLowerCase().includes(search.toLowerCase()) ?? false)
    );
  });

  if (isLoading) {
    return (
      <div className="bg-hw-linear-gradient-day flex flex-col items-center justify-center bg-primary-100 py-4">
        <CanvasBackground />
        <div className="z-10 text-xl">Loading rankings data...</div>
      </div>
    );
  }

  if (!rankingsData) {
    return (
      <div className="bg-hw-linear-gradient-day flex flex-col items-center justify-center bg-primary-100 py-4">
        <CanvasBackground />
        <div className="z-10 mb-4 flex w-full max-w-[85vw] items-center justify-between">
          <h1 className="text-3xl">Application Rankings</h1>
          <div className="flex gap-3">
            <Button 
              variant="primary" 
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Load Rankings
            </Button>
            <Link href="/internal/dashboard">
              <Button variant="primary">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
        <div className="z-10 text-xl text-gray-600">
          Click "Load Rankings" to fetch and display application rankings
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hw-linear-gradient-day flex flex-col items-center justify-center bg-primary-100 py-4 px-4">
      <CanvasBackground />
      <div className="z-10 mb-4 flex w-full max-w-[85vw] items-center justify-between">
        <h1 className="text-3xl">Application Rankings</h1>
        <div className="flex gap-3">
          <Button 
            variant="primary" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/internal/dashboard">
            <Button variant="primary">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
      
      <div className="z-10 mb-4 w-full max-w-[85vw]">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {filteredData?.length} applications found
          </div>
          <div className="relative">
            <Input
              placeholder="Search by name, email, school, or major..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80 pr-10"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        <div className="rounded-lg border bg-white/90 backdrop-blur-sm overflow-x-auto">
          <DataTable 
            columns={rankingsColumns} 
            data={filteredData ?? []} 
          />
        </div>
      </div>
    </div>
  );
};

export default Rankings;
