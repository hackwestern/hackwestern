import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";

import SEO from "~/components/seo";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Confetti } from "~/components/dashboard/confetti";
import { FilmStrip } from "~/components/promo/film-strip";
import {
  FieldError,
  TravelForm,
  type TravelErrors,
} from "~/components/rsvp/travel-form";
import { rsvpTravelSubmitSchema } from "~/schemas/rsvp";
import { CalendarClock } from "lucide-react";
import { type Realm, realmTint } from "~/constants/realms";
import { RSVP_DEADLINE, isPastRsvpDeadline } from "~/lib/date";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { api } from "~/utils/api";

type RsvpStatus = "ACCEPTED" | "CONFIRMED" | "DECLINED";
const CONFETTI_SEEN_KEY = "hw13-rsvp-confetti-seen";
// Primary and secondary buttons size differently; pin both to one height.
const RSVP_BUTTON = "h-12 min-h-0 py-0 font-figtree font-medium";
const RSVP_STATUSES: string[] = ["ACCEPTED", "CONFIRMED", "DECLINED"];

type RsvpProps = {
  status: RsvpStatus;
  realm: Realm | null;
  /** Opened from the acceptance email (/rsvp?celebrate=1): play confetti. */
  celebrate: boolean;
};

const fmt = (o: Intl.DateTimeFormatOptions) =>
  RSVP_DEADLINE.toLocaleString("en-CA", { timeZone: "America/Toronto", ...o });
const deadlineText = `${fmt({ weekday: "long", month: "long", day: "numeric" })} at ${fmt({ hour: "numeric", minute: "2-digit" })} ET`;

const COPY: Record<RsvpStatus | "CLOSED", { title: string; body: string }> = {
  ACCEPTED: {
    title: "You’re invited to Hack Western 13!",
    body: "Hack Western runs November 20–22 at Western University. Tell us how you’re getting here and confirm your spot.",
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
  const [enrolled, setEnrolled] = useState(false);
  // Errors show at each question only after a Confirm attempt, and clear
  // as soon as the question is answered.
  const [attempted, setAttempted] = useState(false);
  const { data: application } = api.application.get.useQuery();
  const accent = realmTint[realm ?? "safari"].accent;
  // Each bump remounts the confetti, so it plays again.
  const [burst, setBurst] = useState(celebrate ? 1 : 0);

  // Confetti the first time an accepted hacker opens this page on a device,
  // however they got here (the email link always plays it).
  useEffect(() => {
    if (initialStatus !== "ACCEPTED") return;
    try {
      if (localStorage.getItem(CONFETTI_SEEN_KEY)) return;
      localStorage.setItem(CONFETTI_SEEN_KEY, "1");
    } catch {
      return;
    }
    setBurst((n) => n + 1);
  }, [initialStatus]);
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

  const travelErrors = useMemo(() => {
    if (!attempted) return {};
    const travel = rsvpTravelSubmitSchema.safeParse(application ?? {});
    if (travel.success) return {};
    return Object.fromEntries(
      travel.error.issues.map((i) => [String(i.path[0]), i.message]),
    ) as TravelErrors;
  }, [attempted, application]);
  const enrollError = attempted && !enrolled;

  function confirm() {
    setAttempted(true);
    const travelOk = rsvpTravelSubmitSchema.safeParse(
      application ?? {},
    ).success;
    if (travelOk && enrolled) {
      rsvp.mutate({ attending: true, enrolled });
      return;
    }
    // Bring the first unanswered question into view (it can be off-screen on a phone).
    requestAnimationFrame(() =>
      document
        .querySelector("[data-rsvp-error]")
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  const copy = COPY[status === "ACCEPTED" && closed ? "CLOSED" : status];
  const deadlinePill =
    status === "ACCEPTED" && !closed
      ? `RSVP by ${deadlineText}`
      : status === "CONFIRMED" && !closed
        ? `You can change your travel plans until ${deadlineText}`
        : null;
  const canEditTravel =
    !closed && (status === "ACCEPTED" || status === "CONFIRMED");

  return (
    <>
      <SEO title="RSVP" description="RSVP for Hack Western 13." noindex />
      {burst > 0 && <Confetti key={burst} />}
      <div className="relative min-h-screen w-full overflow-hidden font-figtree">
        {/* The apply portal's 2400px realm photo (the dashboard's 1024px copy
            goes soft when stretched), pinned so tall content scrolls over it,
            with a light shade so the heading stays readable. */}
        <div className="fixed inset-0">
          <Image
            src={realmTint[realm ?? "safari"].background}
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="object-cover"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-black/35" />
        </div>
        {/* The Hack Western horse doubles as the way home (same spot as on the
            dashboard from md up; above the heading on smaller screens). */}
        <Link
          href="/"
          aria-label="Hack Western home"
          className="absolute left-6 top-8 z-30 rounded-md transition-transform hover:-rotate-6 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-transparent motion-reduce:transition-none motion-reduce:hover:transform-none md:left-[52px] md:top-[70px]"
        >
          <Image
            src="/shared/horse.svg"
            alt=""
            width={40}
            height={60}
            priority
            draggable={false}
          />
        </Link>
        {/* The strip art has padding baked into its box; nudge each strip
            flush with its edge. */}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-20 -translate-y-[6px]">
          <FilmStrip />
        </div>
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 translate-y-[10px]">
          <FilmStrip />
        </div>

        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center gap-8 px-6 pb-16 pt-28 md:py-12">
          <div className="flex flex-col gap-4 text-[#e6edf5] [text-shadow:0_1px_14px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-cossetteTexte text-[30px] font-bold leading-[1.2] sm:text-[36px]">
                {copy.title}
              </h1>
              {status !== "DECLINED" && (
                <button
                  type="button"
                  aria-label="More confetti"
                  title="More confetti"
                  onClick={() => setBurst((n) => n + 1)}
                  className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl backdrop-blur-sm transition hover:scale-110 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100"
                >
                  🎉
                </button>
              )}
            </div>
            <p className="text-base leading-snug">{copy.body}</p>
            {deadlinePill && (
              <p className="inline-flex w-fit items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm [text-shadow:none]">
                <CalendarClock aria-hidden className="h-4 w-4 shrink-0" />
                {deadlinePill}
              </p>
            )}
          </div>

          {canEditTravel && (
            <div className="rounded-2xl bg-white/95 p-6 text-heavy shadow-lg">
              <TravelForm accent={accent} errors={travelErrors} />
              {status === "ACCEPTED" && (
                <div className="mt-8">
                  <label className="flex items-start gap-3 text-sm">
                    <Checkbox
                      checked={enrolled}
                      onCheckedChange={(v) => setEnrolled(v === true)}
                      aria-invalid={enrollError}
                      className={`mt-0.5 ${enrollError ? "border-red-600 ring-1 ring-red-600" : ""}`}
                    />
                    I&apos;m currently enrolled in a college or university
                    program. Hack Western is for post-secondary students.
                  </label>
                  {enrollError && (
                    <FieldError className="ml-7 mt-1.5">
                      Tick this box to confirm your spot
                    </FieldError>
                  )}
                </div>
              )}
              {status === "ACCEPTED" && (
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button
                    variant="primary"
                    full
                    className={RSVP_BUTTON}
                    isPending={rsvp.isPending}
                    onClick={confirm}
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
                <p role="alert" className="mt-4 text-sm text-red-700">
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
  const [open, setOpen] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
            full
            className={RSVP_BUTTON}
            disabled={disabled}
          >
            {label}
          </Button>
        )}
      </AlertDialogTrigger>
      {/* Styled like the rest of the page: rounded card, the HW buttons at
          one size, and the safe choice as the main button. */}
      <AlertDialogContent
        // Land on the safe choice, so Enter keeps the spot.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          keepRef.current?.focus();
        }}
        className="w-[calc(100%-2rem)] max-w-md gap-0 rounded-2xl border-0 p-6 font-figtree shadow-xl"
      >
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="font-cossetteTexte text-2xl font-bold text-heavy">
            Give up your spot?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base leading-snug text-medium">
            You can’t undo this. Once you give up your spot, it’s gone for good.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            ref={keepRef}
            variant="primary"
            full
            className={RSVP_BUTTON}
            onClick={() => setOpen(false)}
          >
            Keep my spot
          </Button>
          <Button
            variant="secondary"
            full
            className={`${RSVP_BUTTON} text-red-700 hover:text-red-800`}
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Yes, give it up
          </Button>
        </div>
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
