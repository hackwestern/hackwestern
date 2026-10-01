import { signOut } from "next-auth/react";
import { getServerSession } from "next-auth";
import type { GetServerSidePropsContext } from "next";
import SEO from "~/components/seo";
import { api } from "~/utils/api";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { disabledRedirect } from "~/utils/redirect";
import { isPastDeadline } from "~/lib/date";
import { PortalShell } from "~/components/dashboard/portal-shell";
import {
  AcceptedStatusCard,
  DeclinedStatusCard,
  NotSubmittedStatusCard,
  RejectedStatusCard,
  SubmittedStatusCard,
  WaitlistedStatusCard,
} from "~/components/dashboard/status-cards";

function StatusContent({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  switch (status) {
    case "ACCEPTED":
    case "CONFIRMED":
      return <AcceptedStatusCard />;
    case "WAITLISTED":
      return <WaitlistedStatusCard />;
    case "REJECTED":
      return <RejectedStatusCard />;
    case "DECLINED":
      return <DeclinedStatusCard />;
    case "NOT_STARTED":
    case "IN_PROGRESS":
      return <NotSubmittedStatusCard />;
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
        {/* undefined = still loading; null = no application row */}
        <StatusContent
          status={
            app === undefined ? undefined : (app?.status ?? "NOT_STARTED")
          }
        />
      </PortalShell>
    </>
  );
}

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  // On dev/preview, organizers land here via login's default callbackUrl;
  // send them to the internal dashboard instead of the (disabled) hacker
  // dashboard.
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
  }

  // Until the deadline, /apply (no step) is the hacker's home: it shows their
  // status and a start/continue/review button. /apply sends people back here
  // once the deadline passes, so only redirect before it to avoid a loop.
  if (!isPastDeadline()) {
    return { redirect: { destination: "/apply", permanent: false } };
  }

  // After the deadline, keep the existing disabled-page behavior.
  return disabledRedirect();
};
