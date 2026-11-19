import { keepNamesTogether } from "~/lib/keep-names-together";
import { useRef, useState } from "react";
import { Crown, Plus } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { initialsOf } from "~/components/sponsors/hacker-avatar";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { MAX_SETUP_REPS, MIN_PHONE_DIGITS, phoneDigits } from "~/lib/coffee-chat-setup";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import {
  cardClass,
  LinkButton,
  StepFooter,
  useAfterInvites,
  useAnnounce,
  useRefreshOwn,
  type SetupData,
} from "./shared";

const copy = sponsorSetupCopy.team;

const inputClass =
  "h-11 w-full rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-base text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary";

/** Step 1 of chatting preferences: reps (name + phone) and the crown. */
export function TeamStep({
  sponsor,
  data,
  backHref,
  nextHref,
}: {
  sponsor: string;
  data: SetupData;
  backHref: string;
  nextHref: string;
}) {
  const utils = api.useUtils();
  const { announce, region } = useAnnounce();
  const { guard, dialog } = useAfterInvites(data);
  const [editing, setEditing] = useState<string | null>(
    data.reps.length === 0 ? "new" : null,
  );
  const [error, setError] = useState<string | null>(null);
  // Before Send, a removed rep can come back (with their times and chats).
  const [removed, setRemoved] = useState<SetupData["reps"][number] | null>(null);
  // The rep Undo already added back, so a retry after a failed step
  // doesn't add them twice.
  const restored = useRef<{ rep: SetupData["reps"][number]; id: string; isPrimary: boolean } | null>(null);
  const refresh = () => utils.coffeeChatSetup.get.invalidate({ sponsor });
  // Saves that can move or drop sent chats: remember the result as seen,
  // so the sponsor's own change isn't shown as an organizer's.
  const refreshOwn = useRefreshOwn(sponsor);
  const onError = (e: { message: string }) => {
    setError(e.message);
    announce(e.message);
  };
  /** Invited hackers in a rep's sent chats. */
  const invitedOf = (repId: string) =>
    data.chats.filter((c) => c.repId === repId).reduce((n, c) => n + c.hackers.length, 0);

  const add = api.coffeeChatSetup.addRep.useMutation({ onError });
  const update = api.coffeeChatSetup.updateRep.useMutation({ onError });
  const remove = api.coffeeChatSetup.removeRep.useMutation({ onError });
  const crown = api.coffeeChatSetup.setPrimary.useMutation({ onError });
  const restorePrefs = api.coffeeChatSetup.savePrefs.useMutation({ onError });
  const undo = async () => {
    const rep = removed;
    if (!rep || add.isPending || restorePrefs.isPending) return;
    setError(null);
    // Organizers may have sent since the removal: check first, so Undo
    // asks before changing a sent setup instead of failing and losing the rep.
    let fresh: SetupData;
    try {
      fresh = await utils.client.coffeeChatSetup.get.query({ sponsor });
    } catch (e) {
      return onError(e instanceof Error ? e : { message: sponsorSetupCopy.errors.saveError });
    }
    guard(
      (confirmAfterInvites) =>
        void (async () => {
          try {
            const back =
              restored.current?.rep === rep
                ? restored.current
                : await add.mutateAsync({ sponsor, name: rep.name, phone: rep.phone, confirmAfterInvites });
            restored.current = { rep, id: back.id, isPrimary: back.isPrimary };
            await restorePrefs.mutateAsync({
              sponsor,
              hackersPerChat: fresh.hackersPerChat,
              reps: [{ id: back.id, chatsWanted: rep.chatsWanted, free: rep.free as ("10" | "11" | "13" | "14" | "15" | "16")[] }],
              confirmAfterInvites,
            });
            if (rep.isPrimary && !back.isPrimary) {
              await crown.mutateAsync({ sponsor, repId: back.id, confirmAfterInvites });
            }
            // Only now is the rep back: until then Undo stays offered.
            restored.current = null;
            setRemoved(null);
            await refreshOwn();
            announce(copy.restored(rep.name));
          } catch {
            // onError already shows what went wrong; Undo stays offered.
            await refresh();
          }
        })(),
      0,
      fresh.confirmed,
    );
  };

  const save = (form: { name: string; phone: string }, repId: string | null) => {
    setError(null);
    const rep = repId ? data.reps.find((r) => r.id === repId) : undefined;
    guard(
      (confirmAfterInvites) => {
        const done = async (msg: string, own: boolean) => {
          await (own ? refreshOwn() : refresh());
          setEditing(null);
          announce(msg);
        };
        if (repId) {
          update.mutate(
            { sponsor, repId, ...form, confirmAfterInvites },
            { onSuccess: () => void done(copy.saved(form.name), true) },
          );
        } else {
          add.mutate(
            { sponsor, ...form, confirmAfterInvites },
            { onSuccess: () => void done(copy.added(form.name), false) },
          );
        }
      },
      // A rename re-asks the rep's invited hackers (their invites name the rep).
      rep && rep.name !== form.name ? invitedOf(rep.id) : 0,
    );
  };

  return (
    <section className={cardClass} aria-labelledby="team-heading">
      {region}
      {dialog}
      <h2 id="team-heading" className="m-0 text-xl font-semibold text-dashboard-text-heavy">
        {copy.heading(keepNamesTogether(data.sponsorName, [data.sponsorName]))}
      </h2>
      <p className="m-0 flex gap-2 rounded-dashboard-md bg-dashboard-bg-inset p-3 text-sm text-dashboard-text-medium">
        <Crown aria-hidden className="mt-0.5 size-4 shrink-0 text-dashboard-text-light" />
        {copy.crownNote}
      </p>
      <h3 className="m-0 text-base font-semibold text-dashboard-text-heavy">{copy.count(data.reps.length)}</h3>
      {removed && (
        <p className="m-0 flex flex-wrap items-center gap-x-2 rounded-dashboard-md bg-dashboard-bg-inset px-3 py-1 text-base text-dashboard-text-heavy">
          {copy.removed(removed.name)}
          <button
            type="button"
            aria-label={copy.undoLabel(removed.name)}
            onClick={() => void undo()}
            className="min-h-11 rounded-dashboard-md px-1 font-semibold text-dashboard-text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
          >
            {copy.undo}
          </button>
        </p>
      )}
      {data.reps.length === 0 && editing !== "new" && (
        <p className="m-0 text-base text-dashboard-text-medium">{copy.empty}</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {data.reps.map((rep) =>
          editing === rep.id ? (
            <li key={rep.id} className="border-b border-dashboard-border-subtle py-3">
              <RepForm
                initial={rep}
                busy={update.isPending}
                onCancel={() => setEditing(null)}
                onSave={(form) => save(form, rep.id)}
              />
            </li>
          ) : (
            <li
              key={rep.id}
              className="flex flex-wrap items-center gap-3 border-b border-dashboard-border-subtle py-3 last:border-b-0"
            >
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-highlight text-xs font-semibold text-dashboard-text-active"
              >
                {initialsOf(rep.name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="break-words text-base font-semibold text-dashboard-text-heavy">{rep.name}</span>
                <span className="whitespace-nowrap text-sm text-dashboard-text-light">{rep.phone}</span>
              </span>
              <span className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
                <button
                  type="button"
                  aria-pressed={rep.isPrimary}
                  aria-label={rep.isPrimary ? copy.isPrimary(rep.name) : copy.makePrimary(rep.name)}
                  disabled={crown.isPending}
                  onClick={() => {
                    if (rep.isPrimary) return;
                    setError(null);
                    guard((confirmAfterInvites) =>
                      crown.mutate(
                        { sponsor, repId: rep.id, confirmAfterInvites },
                        { onSuccess: () => void refresh().then(() => announce(copy.nowPrimary(rep.name))) },
                      ),
                    );
                  }}
                  className={cn(
                    "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-dashboard-md border px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                    rep.isPrimary
                      ? "border-dashboard-border-task bg-dashboard-bg-task text-dashboard-text-task"
                      : "border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-light",
                    pressable,
                  )}
                >
                  <Crown aria-hidden className="size-4" />
                  {rep.isPrimary ? copy.primary : copy.makePrimaryShort}
                </button>
                <DashboardButton
                  variant="link"
                  aria-label={copy.editLabel(rep.name)}
                  onClick={() => setEditing(rep.id)}
                >
                  {copy.edit}
                </DashboardButton>
                <DashboardButton
                  variant="link"
                  className="text-dashboard-text-warning"
                  aria-label={copy.removeLabel(rep.name)}
                  disabled={remove.isPending}
                  onClick={() => {
                    setError(null);
                    guard(
                      (confirmAfterInvites) =>
                        remove.mutate(
                          { sponsor, repId: rep.id, confirmAfterInvites },
                          {
                            onSuccess: () =>
                              void refreshOwn().then(() => {
                                // After Send their invites were moved or
                                // cancelled, so there's nothing to undo.
                                setRemoved(data.confirmed ? null : rep);
                                announce(copy.removed(rep.name));
                              }),
                          },
                        ),
                      // Their chats go, so all their invited hackers are affected.
                      invitedOf(rep.id),
                    );
                  }}
                >
                  {copy.remove}
                </DashboardButton>
              </span>
            </li>
          ),
        )}
      </ul>

      {editing === "new" ? (
        <RepForm
          busy={add.isPending}
          onCancel={data.reps.length > 0 ? () => setEditing(null) : undefined}
          onSave={(form) => save(form, null)}
        />
      ) : data.reps.length < MAX_SETUP_REPS ? (
        <DashboardButton
          variant="outline"
          className={cn("h-11 w-fit text-base", pressable)}
          onClick={() => setEditing("new")}
        >
          <Plus aria-hidden />
          {copy.add}
        </DashboardButton>
      ) : (
        <p className="m-0 text-sm text-dashboard-text-light">{copy.full(MAX_SETUP_REPS)}</p>
      )}

      {error && (
        <p role="alert" className="m-0 text-sm font-semibold text-dashboard-text-warning">
          {error}
        </p>
      )}

      <StepFooter
        back={<LinkButton href={backHref} variant="outline">{sponsorSetupCopy.backStep}</LinkButton>}
        note={data.reps.length === 0 ? copy.needRep : undefined}
        primary={
          data.reps.length > 0 ? (
            <LinkButton href={nextHref}>{copy.next}</LinkButton>
          ) : (
            <DashboardButton disabled className="min-h-11 opacity-dashboard-disabled md:h-11">
              {copy.next}
            </DashboardButton>
          )
        }
      />
    </section>
  );
}

function RepForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial?: { name: string; phone: string };
  busy: boolean;
  onSave: (form: { name: string; phone: string }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [problem, setProblem] = useState<{ name: string | null; phone: string | null }>({ name: null, phone: null });
  const id = initial ? "edit" : "new";
  return (
    <form
      className="flex flex-col gap-3 rounded-dashboard-md bg-dashboard-bg-inset p-3 sm:flex-row sm:flex-wrap sm:items-end"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        const p = phone.trim();
        // Every problem at once, not one per press.
        const why = {
          name: n ? null : copy.needName,
          phone: !p ? copy.needPhone : phoneDigits(p) < MIN_PHONE_DIGITS ? copy.shortPhone : null,
        };
        setProblem(why);
        if (!why.name && !why.phone && !busy) onSave({ name: n, phone: p });
      }}
    >
      <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-dashboard-text-heavy" htmlFor={`${id}-name`}>
        {copy.name}
        <input
          id={`${id}-name`}
          className={inputClass}
          value={name}
          maxLength={255}
          autoComplete="off"
          required
          aria-invalid={!!problem.name || undefined}
          placeholder={copy.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-dashboard-text-heavy" htmlFor={`${id}-phone`}>
        {copy.phone}
        <input
          id={`${id}-phone`}
          className={inputClass}
          type="tel"
          inputMode="tel"
          value={phone}
          maxLength={32}
          autoComplete="off"
          required
          aria-invalid={!!problem.phone || undefined}
          placeholder={copy.phonePlaceholder}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <DashboardButton type="submit" aria-disabled={busy || undefined} className={cn("min-h-11 md:h-11", pressable)}>
          {busy ? copy.saving : copy.save}
        </DashboardButton>
        {onCancel && (
          <DashboardButton type="button" variant="outline" className={cn("h-11", pressable)} onClick={onCancel}>
            {copy.cancel}
          </DashboardButton>
        )}
      </div>
      {(problem.name ?? problem.phone) && (
        <div role="alert" className="flex flex-col gap-1 sm:basis-full">
          {[problem.name, problem.phone].filter(Boolean).map((p) => (
            <p key={p} className="m-0 text-sm font-semibold text-dashboard-text-warning">
              {p}
            </p>
          ))}
        </div>
      )}
    </form>
  );
}
