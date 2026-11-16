import type { GetServerSideProps } from "next";

// The "Interested hackers" list now lives on the coffee chats page, next to
// the shortlist (T45). This route only keeps old links working.
export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const uuid = typeof params?.uuid === "string" ? params.uuid : "";
  return {
    redirect: {
      destination: `/sponsors/${encodeURIComponent(uuid)}/coffee-chats#interested`,
      permanent: false,
    },
  };
};

export default function SponsorHackersRedirect() {
  return null;
}
