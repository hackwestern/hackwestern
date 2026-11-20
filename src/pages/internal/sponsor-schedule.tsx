import type { GetServerSidePropsContext } from "next";
import { legacyScheduleDestination } from "~/lib/sponsor-organizer";

// The organizer run of show moved into the sponsor dashboard's tabs
// (/internal/sponsors). Old links and bookmarks land on the matching tab:
// no ?tab= is Run of show, ?tab=where (or #rooms, which the browser keeps)
// scrolls to the rooms. That page checks the organizer login.
export default function SponsorScheduleMoved() {
  return null;
}

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    redirect: {
      destination: legacyScheduleDestination(context.query),
      permanent: false,
    },
  };
}
