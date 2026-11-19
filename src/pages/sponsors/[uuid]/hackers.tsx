import type { GetServerSideProps } from "next";

// The "Interested hackers" list is now the coffee chat Shortlist flow.
// This route only keeps old links working.
export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const uuid = typeof params?.uuid === "string" ? params.uuid : "";
  return {
    redirect: {
      destination: `/sponsors/${encodeURIComponent(uuid)}/coffee-chats?flow=shortlist&step=1`,
      permanent: false,
    },
  };
};

export default function SponsorHackersRedirect() {
  return null;
}
