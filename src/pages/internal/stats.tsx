import { disabledRedirect } from "~/utils/redirect";
import { api } from "~/utils/api";

function Stats() {
  const { data: statsData } = api.application.getAppStats.useQuery();
  console.log(statsData);

  return (
    <div className="flex w-screen flex-col items-center">
      <div>Apps Stats:</div>
      {statsData && statsData.length > 0 ? (
        statsData.map((stat, index) => (
          <div key={index}>
            <span>
              {stat.status}: {stat.count}
            </span>
          </div>
        ))
      ) : (
        <div>No stats available</div>
      )}
    </div>
  );
}

export const getServerSideProps = disabledRedirect;

export default Stats;
