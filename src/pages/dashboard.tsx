import { signOut } from "next-auth/react";
import { getServerSession } from "next-auth";
import type { GetServerSidePropsContext } from "next";
import SEO from "~/components/seo";
import { api } from "~/utils/api";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { disabledRedirect } from "~/utils/redirect";
import { PortalShell } from "~/components/dashboard/portal-shell";
import {
  AcceptedStatusCard,
  DeclinedStatusCard,
  SubmittedStatusCard,
  WaitlistedStatusCard,
} from "~/components/dashboard/status-cards";

function StatusContent({ status }: { status: string | null | undefined }) {
  switch (status) {
    case "ACCEPTED":
    case "CONFIRMED":
      return <AcceptedStatusCard />;
    case "WAITLISTED":
      return <WaitlistedStatusCard />;
    case "DECLINED":
      return <DeclinedStatusCard />;
    case "PENDING_REVIEW":
    case "IN_REVIEW":
    default:
      return <SubmittedStatusCard />;
  }
}

export default function Dashboard() {
  const { data: app } = api.application.get.useQuery({
    fields: ["status", "firstName"],
  });

  return (
    <>
      <SEO
        title="Dashboard"
        description="Your Hack Western application status."
        noindex
      />
      <PortalShell
        firstName={app?.firstName ?? "there"}
        onSignOut={() => void signOut({ callbackUrl: "/" })}
      >
        <StatusContent status={app?.status} />
      </PortalShell>
    </>
  );
}

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  if (process.env.VERCEL_ENV !== "production") {
    const session = await getServerSession(
      context.req,
      context.res,
      authOptions,
    );
    if (session) {
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, session.user.id),
      });
      if (user?.type === "organizer") {
        return {
          redirect: { destination: "/internal/dashboard", permanent: false },
        };
      }
    }
    return { props: {} };
  }

  return disabledRedirect();
};
