import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { signOut } from "next-auth/react";

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
import {
  normalizeTravel,
  rsvpTravelSubmitSchema,
  type RsvpTravel,
} from "~/schemas/rsvp";
import { CalendarClock, CircleAlert } from "lucide-react";
import { type Realm, realmTint } from "~/constants/realms";
import { formatRsvpDeadline, isPastRsvpDeadline } from "~/lib/date";
import { describeTravel, rsvpView } from "~/lib/rsvp-view";
import { authOptions } from "~/server/auth";
import { getTeamFinderAccess } from "~/server/api/utils/team-finder-access";
import { db } from "~/server/db";
import { api } from "~/utils/api";

type RsvpStatus = "ACCEPTED" | "CONFIRMED" | "DECLINED";
const CONFETTI_SEEN_KEY = "hw13-rsvp-confetti-seen";
// The one main button style on the page; everything secondary is a text link.
const RSVP_BUTTON = "h-12 min-h-0 py-0 font-figtree font-medium";
const TEXT_LINK =
  "text-sm font-medium text-medium underline decoration-gray-3 underline-offset-4 transition-colors hover:text-heavy hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 rounded-sm";
const RSVP_STATUSES: string[] = ["ACCEPTED", "CONFIRMED", "DECLINED"];

// NONE: signed in, but this account has nothing to RSVP to (most often the
// wrong account, e.g. a different Google login than the one they applied with).
type PageStatus = RsvpStatus | "NONE";

type RsvpProps = {
  status: PageStatus;
  /** Shown in the NONE state so they can tell which account they're on. */
  email: string | null;
  realm: Realm | null;
  /** Opened from the acceptance email (/rsvp?celebrate=1): play confetti. */
  celebrate: boolean;
  /**
   * Decided by the server, not the device clock: a phone set to the wrong
   * time must not show RSVP as closed (or open) when the server disagrees.
   */
  closed: boolean;
  deadlineText: string;
  /** Confirmed and the team finder is open: link to it. */
  teamFinder: boolean;
};

// Just the travel answer, from whatever holds it (the saved application or
// the form on screen).
const pickTravel = (a?: RsvpTravel | null): RsvpTravel => ({
  transportationMethod: a?.transportationMethod,
  travelReimbursement: a?.travelReimbursement,
  travelFrom: a?.travelFrom,
});

/**
 * RSVP for accepted hackers (status ACCEPTED -> CONFIRMED or DECLINED).
 * Same look as the submitted dashboard: the realm background with film
 * strips, with the form on a card.
 */
const Rsvp = ({
  status: initialStatus,
  email,
  realm,
  celebrate,
  closed,
  deadlineText,
  teamFinder,
}: RsvpProps) => {
  const router = useRouter();
  const [status, setStatus] = useState<PageStatus>(initialStatus);
  // Follow the server when its props are refreshed (see refreshFromServer).
  useEffect(() => setStatus(initialStatus), [initialStatus]);
  // The travel answer currently on screen, reported by the form as it
  // changes. Null until the form has loaded the saved answer.
  const [draft, setDraft] = useState<RsvpTravel | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  // Errors show at each question only after a Confirm attempt, and clear
  // as soon as the question is answered.
  const [attempted, setAttempted] = useState(false);
  // Once confirmed, the card shows the travel answer with a Change link
  // instead of the full question.
  const [editingTravel, setEditingTravel] = useState(false);
  const travelCardRef = useRef<HTMLDivElement>(null);
  const changeTravelRef = useRef<HTMLButtonElement>(null);
  const { data: application } = api.application.get.useQuery();
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
  const utils = api.useUtils();

  // False once the page is gone (and true again after strict mode's
  // remount). A refused autosave can land after the user has left, since
  // react-query still runs onError then.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // A travel change the server refused (RSVP closed while the page was open).
  const [saveRefused, setSaveRefused] = useState(false);
  // While a refresh is loading: the error that caused it is about to be
  // explained by the refreshed page.
  const [refreshing, setRefreshing] = useState(false);

  // Reload the server's props (status, closed) in place, without scrolling.
  // Not once the page is gone, or it would pull the user back here.
  const refreshFromServer = async () => {
    if (!mounted.current) return;
    setRefreshing(true);
    await router
      .replace(router.asPath, undefined, { scroll: false })
      .finally(() => {
        if (mounted.current) setRefreshing(false);
      });
  };

  const rsvp = api.application.rsvp.useMutation({
    onSuccess: ({ status }) => {
      setStatus(status);
      return utils.application.get.invalidate();
    },
    onError: (err) => {
      // The deadline passed while the page was open, or another tab changed
      // the RSVP: reload the server's view so the page matches it, then drop
      // the error, which the refreshed page now explains.
      if (err.data?.code === "FORBIDDEN" || err.data?.code === "CONFLICT") {
        void refreshFromServer().then(() => rsvp.reset());
      }
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

  // Validate what's on screen, cleaned up the same way the server stores it.
  const travelNow = draft ?? pickTravel(application);
  const travelCheck = rsvpTravelSubmitSchema.safeParse(
    normalizeTravel(travelNow),
  );
  const travelErrors: TravelErrors =
    attempted && !travelCheck.success
      ? (Object.fromEntries(
          travelCheck.error.issues.map((i) => [String(i.path[0]), i.message]),
        ) as TravelErrors)
      : {};
  const enrollError = attempted && !enrolled;
  // Folded to the summary only while the answer on screen is complete (an
  // unfinished one stays open with its errors), or while it's still loading.
  const travelFolded =
    status === "CONFIRMED" &&
    !editingTravel &&
    (!application || travelCheck.success);

  function changeTravel() {
    setEditingTravel(true);
    requestAnimationFrame(() =>
      (
        travelCardRef.current?.querySelector<HTMLElement>(
          '[role="radio"][data-state="checked"]',
        ) ?? travelCardRef.current?.querySelector<HTMLElement>('[role="radio"]')
      )?.focus(),
    );
  }

  function doneTravel() {
    setAttempted(true);
    if (!travelCheck.success) return;
    setAttempted(false);
    setEditingTravel(false);
    requestAnimationFrame(() => changeTravelRef.current?.focus());
  }

  function confirm() {
    setAttempted(true);
    if (travelCheck.success && enrolled) {
      // Send the answer on screen with the confirm: autosave may not have
      // caught up yet, and the server saves both in one update.
      rsvp.mutate({ attending: true, enrolled, travel: travelNow });
      return;
    }
    // Bring the first unanswered question into view (it can be off-screen on a phone).
    requestAnimationFrame(() =>
      document
        .querySelector("[data-rsvp-error]")
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  const { title, body, pill, canEditTravel, showSavedTravel } = rsvpView({
    status,
    closed,
    deadlineText,
  });
  const savedTravel = showSavedTravel
    ? describeTravel(pickTravel(application))
    : null;

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
          {/* Darker where the text sits: the realm photos are brightest at
              the horizon, right behind the heading. */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_110%_60%_at_50%_50%,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.3)_55%,transparent_100%)] sm:bg-[radial-gradient(ellipse_75%_65%_at_50%_50%,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.3)_55%,transparent_100%)]" />
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
            // Hold the 60px box: preflight's height:auto would size it from
            // the SVG's own ratio, which next/image warns about.
            className="h-[60px]"
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
          <div className="flex flex-col gap-4 text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5),0_0_18px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-balance font-cossetteTexte text-[30px] font-bold leading-[1.2] sm:text-[36px]">
                {title}
              </h1>
              {(status === "ACCEPTED" || status === "CONFIRMED") && (
                <button
                  type="button"
                  aria-label="More confetti"
                  title="More confetti"
                  onClick={() => setBurst((n) => n + 1)}
                  className="-mr-2 mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100"
                >
                  🎉
                </button>
              )}
            </div>
            {status === "NONE" && email && (
              <p className="text-base leading-snug">
                You’re signed in as <strong>{email}</strong>.
              </p>
            )}
            <p className="text-pretty text-base leading-snug">{body}</p>
            {pill && (
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <CalendarClock aria-hidden className="h-4 w-4 shrink-0" />
                {pill}
              </p>
            )}
            {saveRefused && showSavedTravel && (
              <p
                aria-live="polite"
                className="flex items-center gap-2 text-sm font-semibold text-white"
              >
                <CircleAlert aria-hidden className="h-4 w-4 shrink-0" />
                Your last change wasn’t saved.
              </p>
            )}
            {savedTravel && (
              <p className="text-sm font-semibold text-white">
                Your travel: {savedTravel}. Need a change? Email{" "}
                <a
                  href="mailto:hello@hackwestern.com"
                  className="underline underline-offset-2 hover:text-white"
                >
                  hello@hackwestern.com
                </a>
              </p>
            )}
          </div>

          {status === "NONE" && (
            <div>
              <Button
                variant="primary"
                className={RSVP_BUTTON}
                onClick={() =>
                  void signOut({ callbackUrl: "/login?callbackUrl=%2Frsvp" })
                }
              >
                Switch account
              </Button>
            </div>
          )}

          {canEditTravel && (
            <div
              ref={travelCardRef}
              className="relative rounded-2xl bg-white/95 p-6 text-heavy shadow-lg"
            >
              {travelFolded && (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-medium">Your travel</p>
                    <p className="mt-1 font-medium">
                      {describeTravel(travelNow)}
                    </p>
                  </div>
                  <button
                    ref={changeTravelRef}
                    type="button"
                    className={TEXT_LINK}
                    onClick={changeTravel}
                  >
                    Change
                  </button>
                </div>
              )}
              {/* Stays mounted while folded, so a change made just before
                  Done still autosaves. */}
              <div hidden={travelFolded}>
                <TravelForm
                  errors={travelErrors}
                  onChange={setDraft}
                  onSaveRefused={() => {
                    if (!mounted.current) return;
                    setSaveRefused(true);
                    void refreshFromServer();
                  }}
                />
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
                  <div className="mt-6 flex flex-col items-center gap-4">
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
                {status === "CONFIRMED" && (
                  <div className="mt-6 flex items-center justify-between gap-4">
                    <p className="text-sm text-medium">
                      Changes save automatically.
                    </p>
                    <button
                      type="button"
                      className={TEXT_LINK}
                      onClick={doneTravel}
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
              {rsvp.error && !refreshing && (
                <p role="alert" className="mt-4 text-sm text-red-700">
                  {rsvp.error.message}
                </p>
              )}
            </div>
          )}

          {status === "CONFIRMED" && teamFinder && (
            <div>
              <Button variant="primary" asChild className={RSVP_BUTTON}>
                <Link href="/team-finder">Find a team</Link>
              </Button>
            </div>
          )}

          {status === "CONFIRMED" && (
            <div className="text-sm text-[#d7e2ef]">
              Can’t make it anymore?{" "}
              <DeclineButton
                label="Give up my spot"
                className="underline underline-offset-2 hover:text-white"
                disabled={rsvp.isPending}
                onConfirm={() => rsvp.mutate({ attending: false })}
              />
              {rsvp.error && !refreshing && !canEditTravel && (
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
  disabled,
  onConfirm,
  className = TEXT_LINK,
}: {
  label: string;
  disabled: boolean;
  onConfirm: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button type="button" className={className} disabled={disabled}>
          {label}
        </button>
      </AlertDialogTrigger>
      {/* Same pattern as the page: one main button (the safe choice) and the
          destructive one as a quiet text link. */}
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
        <div className="mt-6 flex flex-col items-center gap-4">
          <Button
            ref={keepRef}
            variant="primary"
            full
            className={RSVP_BUTTON}
            onClick={() => setOpen(false)}
          >
            Keep my spot
          </Button>
          <button
            type="button"
            className={`${TEXT_LINK} !text-red-700 hover:!text-red-800`}
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Yes, give it up
          </button>
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
  const hasRsvp = !!application && RSVP_STATUSES.includes(application.status);
  const teamFinder =
    application?.status === "CONFIRMED" &&
    (await getTeamFinderAccess(session.user.id)).ok;

  return {
    props: {
      // Never says why there's no RSVP (decisions go out by email).
      status: hasRsvp ? (application.status as RsvpStatus) : "NONE",
      email: hasRsvp ? null : (session.user.email ?? null),
      realm: application?.realm ?? null,
      // Confetti is for the invitation, not for someone who already declined.
      celebrate:
        application?.status === "ACCEPTED" && context.query.celebrate === "1",
      closed: isPastRsvpDeadline(),
      deadlineText: formatRsvpDeadline(),
      teamFinder,
    } satisfies RsvpProps,
  };
};
