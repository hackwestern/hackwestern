import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";

import SEO from "~/components/seo";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Confetti } from "~/components/dashboard/confetti";
import { FilmStrip } from "~/components/promo/film-strip";
import { TravelForm } from "~/components/rsvp/travel-form";
import type { Realm } from "~/constants/realms";
import { RSVP_DEADLINE, isPastRsvpDeadline } from "~/lib/date";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { api } from "~/utils/api";

type RsvpStatus = "ACCEPTED" | "CONFIRMED" | "DECLINED";
const RSVP_STATUSES: string[] = ["ACCEPTED", "CONFIRMED", "DECLINED"];

type RsvpProps = {
  status: RsvpStatus;
  realm: Realm | null;
  /** Opened from the acceptance email (/rsvp?celebrate=1): play confetti. */
  celebrate: boolean;
};

const deadlineText = RSVP_DEADLINE.toLocaleString("en-CA", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Toronto",
  timeZoneName: "short",
});

const COPY: Record<RsvpStatus | "CLOSED", { title: string; body: string }> = {
  ACCEPTED: {
    title: "You’re invited to Hack Western 13!",
    body: `Hack Western runs November 20–22 at Western University. Tell us how you’re getting here, then confirm your spot by ${deadlineText}.`,
  },
  CLOSED: {
    title: "RSVP is closed",
    body: `The RSVP deadline was ${deadlineText}, so your spot has been released. We hope to see you at a future Hack Western.`,
  },
  CONFIRMED: {
    title: "You’re confirmed. See you there!",
    body: "Hack Western runs November 20–22 at Western University. We’ll email you the schedule and check-in details closer to the event.",
  },
  DECLINED: {
    title: "You’ve declined your spot",
    body: "Thanks for letting us know. We hope to see you at a future Hack Western.",
  },
};

/**
 * RSVP for accepted hackers (status ACCEPTED -> CONFIRMED or DECLINED).
 * Same look as the submitted dashboard: the realm background with film
 * strips, with the form on a card.
 */
const Rsvp = ({ status: initialStatus, realm, celebrate }: RsvpProps) => {
  const router = useRouter();
  const [status, setStatus] = useState<RsvpStatus>(initialStatus);
  const closed = isPastRsvpDeadline();
  const utils = api.useUtils();

  const rsvp = api.application.rsvp.useMutation({
    onSuccess: ({ status }) => {
      setStatus(status);
      return utils.application.get.invalidate();
    },
  });

  // Drop ?celebrate once the confetti has started, so a refresh doesn't replay it.
  useEffect(() => {
    if (router.query.celebrate === undefined) return;
    const { celebrate: _celebrate, ...query } = router.query;
    void router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  }, [router]);

  const copy = COPY[status === "ACCEPTED" && closed ? "CLOSED" : status];
  const canEditTravel =
    !closed && (status === "ACCEPTED" || status === "CONFIRMED");

  return (
    <>
      <SEO title="RSVP" description="RSVP for Hack Western 13." noindex />
      {celebrate && <Confetti />}
      <div className="relative min-h-screen w-full overflow-hidden font-figtree">
        <Image
          src={`/dashboard/realm/${realm ?? "safari"}.png`}
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover"
          draggable={false}
        />
        <div className="pointer-events-none fixed inset-x-0 top-0 z-20">
          <FilmStrip />
        </div>
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
          <FilmStrip />
        </div>

        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center gap-8 px-6 py-24">
          <div className="flex flex-col gap-4 text-[#d7e2ef]">
            <h1 className="font-cossetteTexte text-[30px] font-bold leading-[1.2] sm:text-[36px]">
              {copy.title}
            </h1>
            <p className="text-base leading-snug">{copy.body}</p>
          </div>

          {canEditTravel && (
            <div className="rounded-2xl bg-white/95 p-6 text-heavy shadow-lg">
              <TravelForm />
              {status === "ACCEPTED" && (
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="primary"
                    className="font-figtree font-medium"
                    disabled={rsvp.isPending}
                    onClick={() => rsvp.mutate({ attending: true })}
                  >
                    Confirm my spot
                  </Button>
                  <DeclineButton
                    label="I can’t make it"
                    disabled={rsvp.isPending}
                    onConfirm={() => rsvp.mutate({ attending: false })}
                  />
                </div>
              )}
              {rsvp.error && (
                <p className="mt-4 text-sm text-red-600">
                  {rsvp.error.message}
                </p>
              )}
            </div>
          )}

          {status === "CONFIRMED" && (
            <div className="text-sm text-[#d7e2ef]">
              Can’t make it anymore?{" "}
              <DeclineButton
                label="Give up my spot"
                asLink
                disabled={rsvp.isPending}
                onConfirm={() => rsvp.mutate({ attending: false })}
              />
              {rsvp.error && !canEditTravel && (
                <p className="mt-2 text-red-300">{rsvp.error.message}</p>
              )}
            </div>
          )}

          <div>
            <Button
              variant="primary"
              asChild
              className="font-figtree font-medium"
            >
              <Link href="/">
                <img
                  src="/shared/arrow-left.svg"
                  alt=""
                  width={16}
                  height={16}
                  className="mr-[10px]"
                />
                Return home
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
export default Rsvp;

function DeclineButton({
  label,
  asLink = false,
  disabled,
  onConfirm,
}: {
  label: string;
  asLink?: boolean;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {asLink ? (
          <button
            type="button"
            className="underline underline-offset-2"
            disabled={disabled}
          >
            {label}
          </button>
        ) : (
          <Button
            variant="secondary"
            className="font-figtree font-medium"
            disabled={disabled}
          >
            {label}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Give up your spot?</AlertDialogTitle>
          <AlertDialogDescription>
            This can’t be undone. Your spot won’t come back if you change your
            mind.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep my spot</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Yes, give it up
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  // The acceptance email links here; carry the link through login.
  if (!session) {
    return {
      redirect: {
        destination: `/login?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const application = await db.query.applications.findFirst({
    where: (applications, { eq }) => eq(applications.userId, session.user.id),
    columns: { status: true, realm: true },
  });
  if (!application || !RSVP_STATUSES.includes(application.status)) {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  return {
    props: {
      status: application.status as RsvpStatus,
      realm: application.realm,
      celebrate: context.query.celebrate === "1",
    } satisfies RsvpProps,
  };
};
