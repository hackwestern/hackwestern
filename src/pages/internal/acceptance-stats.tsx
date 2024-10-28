import { api } from "~/utils/api";
import { DataTable } from "~/components/ui/data-table";
import { allUsersWithReviewStatsColumns } from "~/components/columns";
import { useState, useMemo, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { authRedirectOrganizer } from "~/utils/redirect";

type Gender =
  | "Other"
  | "Prefer not to answer"
  | "Female"
  | "Male"
  | "Non-Binary";
type GenderCounts = {
  [key in Gender]?: number;
};

type SchoolCounts = Record<string, number>;

const AcceptanceStats = () => {
  const { data: allUserData } = api.review.getAllUsersWithReviewStats.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false, // Disable refetching on window focus
      refetchOnMount: false, // Disable refetching on mount
    },
  );

  useEffect(() => {
    applyWeightingsAndSort();
  }, [allUserData]);

  // State for weightings
  const [originalityWeight, setOriginalityWeight] = useState(1); // Default is 100%
  const [technicalityWeight, setTechnicalityWeight] = useState(1); // Default is 100%
  const [passionWeight, setPassionWeight] = useState(1); // Default is 100%
  const [sortedUserData, setSortedUserData] = useState(
    allUserData ? allUserData : [],
  );

  // Memoize the sorted data with weightings
  const applyWeightingsAndSort = () => {
    if (!allUserData) return;

    const sortedData = [...allUserData].sort((a, b) => {
      if (a.referral && !b.referral) return -1; // a comes first
      if (!a.referral && b.referral) return 1; // b comes first

      // Apply the weightings
      const aTotal =
        a.avgOriginalityRating * originalityWeight +
        a.avgTechnicalityRating * technicalityWeight +
        a.avgPassionRating * passionWeight;
      const bTotal =
        b.avgOriginalityRating * originalityWeight +
        b.avgTechnicalityRating * technicalityWeight +
        b.avgPassionRating * passionWeight;
      return bTotal - aTotal;
    });

    setSortedUserData(sortedData);
  };

  const genderStats = useMemo(() => {
    const genderCounts: GenderCounts = sortedUserData
      .slice(0, 450)
      .reduce((counts, user) => {
        if (user.gender) {
          counts[user.gender] = (counts[user.gender] ?? 0) + 1;
        }
        return counts;
      }, {} as GenderCounts);

    const totalTopUsers = Math.min(450, sortedUserData.length);
    return (Object.keys(genderCounts) as Gender[]).map((gender) => ({
      gender,
      count: genderCounts[gender] ?? 0, // Include the actual count
      percentage: (((genderCounts[gender] ?? 0) / totalTopUsers) * 100).toFixed(
        2,
      ),
    }));
  }, [sortedUserData]);

  const schoolStats = useMemo(() => {
    const schoolCounts: SchoolCounts = sortedUserData
      .slice(0, 450)
      .reduce((counts, user) => {
        if (user.school) {
          counts[user.school] = (counts[user.school] ?? 0) + 1;
        }
        return counts;
      }, {} as SchoolCounts);

    const totalTopUsers = Math.min(450, sortedUserData.length);
    return Object.keys(schoolCounts).map((school) => ({
      school,
      count: schoolCounts[school] ?? 0, // Include the actual count
      percentage: (((schoolCounts[school] ?? 0) / totalTopUsers) * 100).toFixed(
        2,
      ),
    }));
  }, [sortedUserData]);

  return (
    <div className="flex flex-col items-center justify-center overflow-clip bg-primary-100 bg-hw-linear-gradient-day py-4">
      <h1 className="z-10 mb-5 text-3xl font-bold">
        Acceptance Stats Dashboard
      </h1>

      {/* Weightings Section */}
      <div className="z-10 mb-8 flex w-full flex-col items-center justify-center rounded-lg bg-white p-4 shadow-lg">
        <h2 className="mb-4 text-xl font-semibold">Set Weightings</h2>
        <div className="mb-4 flex flex-col gap-2">
          <label className="flex flex-col">
            Originality Weight (%):
            <input
              type="number"
              placeholder="100"
              onChange={(e) =>
                setOriginalityWeight(Number(e.target.value) / 100)
              } // Store as decimal
              className="ml-2 rounded border border-gray-400 p-2"
            />
          </label>
          <label className="flex flex-col">
            Technicality Weight (%):
            <input
              type="number"
              placeholder="100"
              onChange={(e) =>
                setTechnicalityWeight(Number(e.target.value) / 100)
              } // Store as decimal
              className="ml-2 rounded border border-gray-400 p-2"
            />
          </label>
          <label className="flex flex-col">
            Passion Weight (%):
            <input
              type="number"
              placeholder="100"
              onChange={(e) => setPassionWeight(Number(e.target.value) / 100)} // Store as decimal
              className="ml-2 rounded border border-gray-400 p-2"
            />
          </label>
        </div>
        <Button onClick={applyWeightingsAndSort} variant="primary">
          Apply Weightings
        </Button>
      </div>

      {/* Gender and School Stats Section */}
      <div className="mb-8 flex w-full flex-row justify-evenly">
        {/* Gender Stats */}
        <div className="mt-8 w-1/3 rounded-lg bg-white p-4 shadow-lg">
          <h2 className="mb-2 text-xl font-semibold">
            Gender Distribution (Top 450)
          </h2>
          <ul className="ml-5 list-disc">
            {genderStats.map((stat) => (
              <li key={stat.gender}>
                {stat.gender}: {stat.count} ({stat.percentage}%)
              </li>
            ))}
          </ul>
        </div>
        {/* School Stats */}
        <div className="mt-8 w-1/3 rounded-lg bg-white p-4 shadow-lg">
          <h2 className="mb-2 text-xl font-semibold">
            School Distribution (Top 450)
          </h2>
          <ul className="ml-5 list-disc">
            {schoolStats.map((stat) => (
              <li key={stat.school}>
                {stat.school}: {stat.count} ({stat.percentage}%)
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Data Table Section */}
      {/* <div className="z-10 mt-4 h-full w-[90%]">
        {allUserData ? (
          <DataTable
            data={sortedUserData}
            columns={allUsersWithReviewStatsColumns}
          />
        ) : (
          <h2>Loading...</h2>
        )}
      </div> */}
    </div>
  );
};

export const getServerSideProps = authRedirectOrganizer;

export default AcceptanceStats;
