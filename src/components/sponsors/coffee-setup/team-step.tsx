import { useState } from "react";
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
  const refresh = () => utils.coffeeChatSetup.get.invalidate({ sponsor });
  const onError = (e: { message: string }) => {
    setError(e.message);
    announce(e.message);
  };

  const add = api.coffeeChatSetup.addRep.useMutation({ onError });
  const update = api.coffeeChatSetup.updateRep.useMutation({ onError });
  const remove = api.coffeeChatSetup.removeRep.useMutation({ onError });
  const crown = api.coffeeChatSetup.setPrimary.useMutation({ onError });

  const save = (form: { name: string; phone: string }, repId: string | null) => {
    setError(null);
    guard((confirmAfterInvites) => {
      const done = async (msg: string) => {
        await refresh();
        setEditing(null);
        announce(msg);
      };
      if (repId) {
        update.mutate(
          { sponsor, repId, ...form, confirmAfterInvites },
          { onSuccess: () => void done(copy.saved(form.name)) },
        );
      } else {
        add.mutate(
          { sponsor, ...form, confirmAfterInvites },
          { onSuccess: () => void done(copy.added(form.name)) },
        );
      }
    });
  };

  return (
    <section className={cardClass} aria-labelledby="team-heading">
      {region}
      {dialog}
      <h2 id="team-heading" className="m-0 text-xl font-semibold text-dashboard-text-heavy">
        {copy.heading(data.sponsorName)}
      </h2>
      <p className="m-0 flex gap-2 rounded-dashboard-md bg-dashboard-bg-inset p-3 text-sm text-dashboard-text-medium">
        <Crown aria-hidden className="mt-0.5 size-4 shrink-0 text-dashboard-text-light" />
        {copy.crownNote}
      </p>
      <h3 className="m-0 text-base font-semibold text-dashboard-text-heavy">{copy.count(data.reps.length)}</h3>
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
                          { onSuccess: () => void refresh().then(() => announce(copy.removed(rep.name))) },
                        ),
                      // Their chats go, so all their invited hackers are affected.
                      data.chats.filter((c) => c.repId === rep.id).reduce((n, c) => n + c.hackers.length, 0),
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
  const [problem, setProblem] = useState<string | null>(null);
  const id = initial ? "edit" : "new";
  return (
    <form
      className="flex flex-col gap-3 rounded-dashboard-md bg-dashboard-bg-inset p-3 sm:flex-row sm:flex-wrap sm:items-end"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        const p = phone.trim();
        const why = !n
          ? copy.needName
          : !p
            ? copy.needPhone
            : phoneDigits(p) < MIN_PHONE_DIGITS
              ? copy.shortPhone
              : null;
        setProblem(why);
        if (!why && !busy) onSave({ name: n, phone: p });
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
      {problem && (
        <p role="alert" className="m-0 text-sm font-semibold text-dashboard-text-warning sm:basis-full">
          {problem}
        </p>
      )}
    </form>
  );
}
