import { DashboardPanel } from "~/components/internals/dashboard-panel";
import VenueMap from "~/components/live/venue-map";

const Map = () => (
  <div className="flex flex-col gap-6 pb-16 font-figtree">
    <VenueMap />
    <DashboardPanel title="Venue">
      <p className="text-base font-medium text-dashboard-text-medium">
        This year&apos;s event will be at the Ronald D. Schmeichel Building for
        Entrepreneurship and Innovation!
      </p>
      <p className="text-base font-medium text-dashboard-text-medium">
        <b className="font-semibold text-dashboard-text-heavy">Address:</b> 1317
        Western Rd, London, ON
      </p>
    </DashboardPanel>
  </div>
);

export default Map;
