import Link from "next/link";
import { useRouter } from "next/router";
import { Crown, Info, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Note } from "~/components/sponsors/portal-ui";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import {
  availChats,
  availableFree,
  repChatCap,
  setupWindows,
} from "~/lib/coffee-chat-setup";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { AvailabilityGrid, workshopWhen } from "./availability-grid";
import {
  cardClass,
  clockOf,
  LinkButton,
  sessionLabel,
  shortClock,
  StepFooter,
  useAfterInvites,
  useAnnounce,
  type SetupData,
} from "./shared";

const copy = sponsorSetupCopy.review;
const prefsCopy = sponsorSetupCopy.prefs;

const shift = (t: string, by: number) => {
  const [h, m] = t.split(":").map(Number) as [number, number];
  return shortClock(clockOf(h * 60 + m + by));
};
const minus15 = (t: string) => shift(t, -15);
const plus15 = (t: string) => shift(t, 15);

/**
 * Part 3: warnings with fixes, a read-only summary, Send availability.
 * Sending goes back to the Chats page with a toast (mock sponsor-chats-v3).
 */
export function ReviewStep({
  sponsor,
  data,
  teamHref,
  prefsHref,
  homeHref,
}: {
  sponsor: string;
  data: SetupData;
  teamHref: string;
  prefsHref: string;
  /** The Chats page, where Send availability lands. */
  homeHref: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const { announce, region } = useAnnounce();
  const { guard, dialog } = useAfterInvites(data);
  const submit = api.coffeeChatSetup.submitPrefs.useMutation({
    onSuccess: async () => {
      await utils.coffeeChatSetup.get.invalidate({ sponsor });
      toast(
        data.submittedAt ? copy.savedToast : sponsorSetupCopy.page.sentToast,
      );
      await router.push(homeHref);
    },
    onError: (e) => announce(e.message),
  });

  const windows = setupWindows(data.workshops, data.chatMinutes);
  const reps = [...data.reps].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary),
  );
  const rows = reps.map((rep) => {
    const avail = availableFree(rep.free, windows.blocked);
    const cap = repChatCap(rep.chatsWanted, availChats(rep.free, windows));
    return { rep, avail, cap };
  });
  const primary = data.reps.find((r) => r.isPrimary);

  const warnings: { text: string; fix: string; href: string }[] = [];
  if (!primary)
    warnings.push({ text: copy.noPrimary, fix: copy.fixTeam, href: teamHref });
  for (const { rep, avail, cap } of rows) {
    if (rep.chatsWanted > 0 && avail.length === 0) {
      warnings.push({
        text: prefsCopy.notFree(rep.name),
        fix: copy.fixFree,
        href: prefsHref,
      });
    } else if (rep.chatsWanted > cap) {
      warnings.push({
        text: prefsCopy.capped(rep.name, avail.length, cap),
        fix: copy.fixChats(rep.name),
        href: prefsHref,
      });
    }
  }
  const blocking =
    data.totals.chats === 0 || !primary || data.reps.length === 0;
  if (data.totals.chats === 0 && data.reps.length > 0) {
    warnings.unshift({
      text: copy.noChats,
      fix: copy.fixFree,
      href: prefsHref,
    });
  }

  const when = workshopWhen(data);

  return (
    <section className={cardClass} aria-labelledby="review-heading">
      {region}
      {dialog}
      <h2
        id="review-heading"
        className="m-0 text-xl font-semibold text-dashboard-text-heavy"
      >
        {copy.heading}
      </h2>

      {warnings.length === 0 ? (
        <Note tone="ok" icon={<Info aria-hidden />}>
          {copy.allGood}
        </Note>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {warnings.map((w) => (
            <li key={w.text}>
              <Note tone="warn" icon={<TriangleAlert aria-hidden />}>
                {w.text}{" "}
                <Link
                  href={w.href}
                  className="inline-flex min-h-11 items-center px-2 font-semibold text-dashboard-text-link"
                >
                  {w.fix}
                </Link>
              </Note>
            </li>
          ))}
        </ul>
      )}

      <h3 className="m-0 text-base font-semibold text-dashboard-text-heavy">
        {copy.whenFree}
      </h3>
      <AvailabilityGrid
        data={data}
        windows={windows}
        free={Object.fromEntries(data.reps.map((r) => [r.id, r.free]))}
      />

      <p className="m-0 text-lg font-semibold text-dashboard-text-heavy">
        {copy.summary(
          data.hackersPerChat,
          data.chatMinutes,
          data.totals.chats,
          data.totals.hackers,
        )}
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-base font-semibold text-dashboard-text-heavy">
            {copy.yourTeam}
          </h3>
          <Link
            href={teamHref}
            className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-dashboard-text-link"
          >
            {copy.edit}
          </Link>
        </div>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map(({ rep, avail, cap }) => (
            <li key={rep.id} className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 text-base text-dashboard-text-heavy">
                <span className="font-semibold">{rep.name}</span>
                {rep.isPrimary && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-dashboard-notice-cautionBg px-2 py-0.5 text-xs font-semibold text-dashboard-text-warning">
                    <Crown aria-hidden className="size-3" />
                    {sponsorSetupCopy.team.primaryContact}
                  </span>
                )}
                <span>· {rep.phone}</span>
              </span>
              <span className="text-sm text-dashboard-text-medium">
                {copy.freeAt(avail.map(sessionLabel).join(", "), avail.length)}
              </span>
              <span className="text-sm text-dashboard-text-medium">
                {copy.repChats(
                  Math.min(cap, rep.chatsWanted),
                  data.chatMinutes,
                  rep.chatsWanted,
                  rep.chatsWanted > cap,
                )}
              </span>
            </li>
          ))}
        </ul>
        {primary && (
          <p className="m-0 text-base font-semibold text-dashboard-text-heavy">
            {copy.contactLine(primary.name, primary.phone)}
          </p>
        )}
      </div>

      {when && (
        <div className="flex flex-col gap-0.5 border-t border-dashboard-border-subtle pt-3">
          <h3 className="m-0 text-sm font-semibold text-dashboard-text-medium">
            {copy.workshop}
          </h3>
          {data.workshops.map((w) => (
            <p
              key={`${w.start}-${w.title}`}
              className="m-0 text-base text-dashboard-text-heavy"
            >
              {copy.workshopLine(
                `${shortClock(w.start)}–${shortClock(w.end)}`,
                w.title,
                w.location,
              )}
            </p>
          ))}
          <p className="m-0 text-sm text-dashboard-text-light">
            {copy.buffers(
              `${minus15(data.workshops[0]!.start)}–${shortClock(data.workshops[0]!.start)}`,
              `${shortClock(data.workshops.at(-1)!.end)}–${plus15(data.workshops.at(-1)!.end)}`,
            )}
          </p>
        </div>
      )}

      <StepFooter
        back={
          <LinkButton href={prefsHref} variant="outline">
            {sponsorSetupCopy.backStep}
          </LinkButton>
        }
        note={copy.submitNote}
        primary={
          <DashboardButton
            className={cn(
              "min-h-11 md:h-11",
              pressable,
              blocking && "opacity-dashboard-disabled",
            )}
            aria-disabled={blocking || submit.isPending || undefined}
            onClick={() => {
              if (blocking || submit.isPending) return;
              guard((confirmAfterInvites) =>
                submit.mutate({ sponsor, confirmAfterInvites }),
              );
            }}
          >
            {submit.isPending
              ? copy.submitting
              : data.submittedAt
                ? copy.resubmit
                : copy.submit}
          </DashboardButton>
        }
      />
      {submit.error && (
        <p
          role="alert"
          className="m-0 text-sm font-semibold text-dashboard-text-warning"
        >
          {submit.error.message}
        </p>
      )}
    </section>
  );
}
