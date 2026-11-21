import { type GetServerSideProps } from "next";

// Team results now live on the Roster page.
export default function TeamResultsRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = () =>
  Promise.resolve({
    redirect: { destination: "/internal/roster?tab=teams", permanent: false },
  });
