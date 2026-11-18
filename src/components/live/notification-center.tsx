import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Bell, Coffee, Presentation } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { pressable } from "~/components/sponsors/sponsor-shell";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { notificationsCopy } from "~/content/notifications";
import { formatCoffeeChatTime } from "~/lib/coffee-chats";
import type { HackerNotice } from "~/lib/hacker-notifications";
import { slackEmailInput } from "~/lib/slack-email";
import { formatPresentationTime } from "~/lib/sponsor-presentations";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

const copy = notificationsCopy;

const pill =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold";

const chatPill: Record<string, string> = {
  pending: "bg-dashboard-action-primary text-dashboard-text-inverse",
  accepted: "bg-dashboard-status-live text-dashboard-text-inverse",
};
const quietPill = "bg-dashboard-bg-nav text-dashboard-text-medium";

/**
 * The hacker's notification center on /live: a bell with an unread count
 * that opens a sheet listing their coffee chats and judging times
 * (notifications.center), plus the email they use on Slack. Opening it
 * marks everything read; notices that were unread keep their dot until it
 * closes.
 */
export default function NotificationCenter({
  className,
}: {
  className?: string;
}) {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const q = api.notifications.center.useQuery(undefined, {
    enabled: !!session?.user?.id,
    refetchInterval: 30_000,
  });
  const markSeen = api.notifications.markSeen.useMutation({
    onSettled: () => utils.notifications.center.invalidate(),
  });
  const [open, setOpen] = useState(false);
  // Keys that were unread while the sheet is open, so their dot stays.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  const unread = q.data?.unread ?? 0;
  const notices = q.data?.notices ?? [];

  // While open, anything new that arrives is marked read too.
  useEffect(() => {
    if (!open || unread === 0 || markSeen.isPending) return;
    setFresh(
      (prev) =>
        new Set([
          ...prev,
          ...notices.filter((n) => n.unread).map((n) => n.key),
        ]),
    );
    markSeen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unread]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFresh(new Set());
      }}
    >
      <SheetTrigger
        aria-label={copy.bellLabel(unread)}
        className={cn(
          "relative flex size-11 shrink-0 cursor-pixel-hover items-center justify-center rounded-full text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
          "[@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
          pressable,
          className,
        )}
      >
        <Bell aria-hidden className="size-6" />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-dashboard-status-warning px-[5px] font-figtree text-[11px] font-bold leading-none text-dashboard-text-inverse"
          >
            {unread}
          </span>
        )}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-6 overflow-y-auto border-0 bg-dashboard-bg-page px-5 pb-8 pt-5 font-figtree sm:max-w-md"
        closeClassName="right-4 top-4 flex size-11 items-center justify-center opacity-100 text-dashboard-text-heavy data-[state=open]:bg-transparent focus:ring-dashboard-action-primary"
        closeIconClassName="size-6"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetTitle className="m-0 flex min-h-11 items-center pr-12 text-xl font-semibold text-dashboard-text-heavy">
          {copy.heading}
        </SheetTitle>

        {q.isPending ? (
          <p className="m-0 text-sm text-dashboard-text-light">
            {copy.loading}
          </p>
        ) : q.isError ? (
          <div className="flex flex-col items-start gap-2">
            <p className="m-0 text-sm text-dashboard-text-warning">
              {copy.loadError}
            </p>
            <DashboardButton variant="link" onClick={() => void q.refetch()}>
              {copy.retry}
            </DashboardButton>
          </div>
        ) : notices.length === 0 ? (
          <p className="m-0 text-sm text-dashboard-text-medium">{copy.empty}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {notices.map((n) => (
              <li key={n.key}>
                <NoticeRow
                  notice={n}
                  isNew={n.unread || fresh.has(n.key)}
                  onOpenLink={() => setOpen(false)}
                />
              </li>
            ))}
          </ul>
        )}

        {q.data && (
          <SlackEmailForm
            applicationEmail={q.data.applicationEmail}
            slackEmail={q.data.slackEmail}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function NoticeRow({
  notice,
  isNew,
  onOpenLink,
}: {
  notice: HackerNotice;
  isNew: boolean;
  onOpenLink: () => void;
}) {
  const isChat = notice.kind === "coffeeChat";
  const Icon = isChat ? Coffee : Presentation;
  const title = isChat
    ? copy.coffeeChat.title[notice.status](notice.sponsorName)
    : copy.presentation.title(notice.sponsorName);
  const detail = isChat
    ? copy.coffeeChat.detail(
        formatCoffeeChatTime(notice.slotTime),
        notice.durationMinutes,
        notice.room ?? copy.coffeeChat.roomTbd,
      )
    : copy.presentation.detail(
        formatPresentationTime(notice.start),
        notice.room,
      );
  const status = isChat
    ? copy.coffeeChat.status[notice.status]
    : copy.presentation.status;
  const statusClass = isChat
    ? (chatPill[notice.status] ?? quietPill)
    : quietPill;
  const channel = notice.kind === "presentation" ? notice.channel : null;

  const body = (
    <>
      <Icon
        aria-hidden
        className="mt-0.5 size-5 shrink-0 text-dashboard-action-primary"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p
          className={cn(
            "m-0 break-words text-base text-dashboard-text-heavy",
            isNew ? "font-semibold" : "font-medium",
          )}
        >
          {title}
        </p>
        <p className="m-0 text-sm tabular-nums text-dashboard-text-medium">
          {detail}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <span className={cn(pill, statusClass)}>{status}</span>
          {channel && (
            <span
              className={cn(
                pill,
                "bg-transparent px-0 font-medium text-dashboard-text-light",
              )}
            >
              {copy.channel[channel]}
            </span>
          )}
        </div>
      </div>
      {isNew && (
        <span className="mt-2 size-2 shrink-0 rounded-full bg-dashboard-status-warning">
          <span className="sr-only">{copy.newLabel}</span>
        </span>
      )}
    </>
  );

  const rowClass = cn(
    "flex w-full items-start gap-3 rounded-dashboard-lg border p-4 text-left",
    isNew
      ? "border-dashboard-border-card bg-dashboard-bg-surface shadow-dashboard-card"
      : "border-dashboard-border-subtle bg-dashboard-bg-surface",
  );

  if (!isChat) return <div className={rowClass}>{body}</div>;
  return (
    <Link
      href={`/live?tab=coffee-chats&chat=${encodeURIComponent(notice.chatId)}`}
      shallow
      onClick={onOpenLink}
      className={cn(
        rowClass,
        pressable,
        "cursor-pixel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:bg-dashboard-bg-highlightSubtle",
      )}
    >
      {body}
    </Link>
  );
}

function SlackEmailForm({
  applicationEmail,
  slackEmail,
}: {
  applicationEmail: string;
  slackEmail: string | null;
}) {
  const s = copy.settings;
  const id = useId();
  const utils = api.useUtils();
  const [value, setValue] = useState(slackEmail ?? "");
  const [saved, setSaved] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const save = api.notifications.setSlackEmail.useMutation({
    onSuccess: (result) => {
      setValue(result.slackEmail ?? "");
      setSaved(true);
      void utils.notifications.center.invalidate();
    },
  });
  const dirty = value.trim().toLowerCase() !== (slackEmail ?? "");
  const error = invalid
    ? s.invalid
    : save.error
      ? (save.error.data?.zodError?.fieldErrors.slackEmail?.[0] ?? s.error)
      : null;

  return (
    <form
      noValidate
      className="flex flex-col gap-2 border-t border-dashboard-border-default pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        const checked = slackEmailInput(s.invalid).safeParse(value);
        setInvalid(!checked.success);
        if (checked.success) save.mutate({ slackEmail: checked.data });
      }}
    >
      <label
        htmlFor={id}
        className="text-base font-semibold text-dashboard-text-heavy"
      >
        {s.heading}
      </label>
      <p className="m-0 text-sm text-dashboard-text-medium">
        {s.hint(applicationEmail)}
      </p>
      <div className="flex gap-2">
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={255}
          value={value}
          placeholder={s.placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-status`}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
            setInvalid(false);
          }}
          className="h-11 min-w-0 flex-1 rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-base text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
        />
        <DashboardButton
          type="submit"
          variant="outline"
          disabled={!dirty || save.isPending}
          className={cn("h-11 shrink-0 px-4 text-sm font-semibold", pressable)}
        >
          {save.isPending ? s.saving : s.save}
        </DashboardButton>
      </div>
      <p
        id={`${id}-status`}
        aria-live="polite"
        className={cn(
          "m-0 text-sm",
          error ? "text-dashboard-text-warning" : "text-dashboard-text-light",
        )}
      >
        {error ?? (saved ? s.saved : s.fallback(applicationEmail))}
      </p>
    </form>
  );
}
