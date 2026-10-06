import { useState } from "react";
import { api } from "~/utils/api";
import {
  BTN_DARK,
  CARD,
  CARD_TITLE,
  FIELD,
  MUTED,
  SPONSOR_TRACKS,
  type Status,
  StatusLine,
  errorText,
} from "./control-shared";

type Kind = "organizer" | (typeof SPONSOR_TRACKS)[number];

export function ControlAddJudge() {
  const utils = api.useUtils();
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<Kind>("organizer");
  const [status, setStatus] = useState<Status>(null);
  const add = api.judging.admin.addJudgeByEmail.useMutation();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!address) {
      setStatus({ tone: "error", text: "Enter their email address." });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setStatus({
        tone: "error",
        text: "That doesn't look like an email address.",
      });
      return;
    }
    setStatus(null);
    add.mutate(
      kind === "organizer"
        ? { email: address, type: "organizer" }
        : { email: address, type: "sponsored", track: [kind] },
      {
        onSuccess: (judge) => {
          const role =
            kind === "organizer"
              ? "an organizer judge"
              : `a sponsor judge for ${kind}`;
          setStatus({
            tone: "ok",
            text: `${judge.name ?? address} is now ${role}. They can sign in and press "Get my next team".`,
          });
          setEmail("");
          void utils.judging.admin.invalidate();
        },
        onError: (err) => setStatus({ tone: "error", text: errorText(err) }),
      },
    );
  }

  return (
    <section className={CARD} aria-labelledby="add-judge-title">
      <h2 id="add-judge-title" className={CARD_TITLE}>
        Add judges
      </h2>
      <form
        noValidate
        onSubmit={submit}
        className="flex flex-wrap items-end gap-2.5"
      >
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
          <label htmlFor="judge-email" className={`text-sm ${MUTED}`}>
            Their Hack Western account email
          </label>
          <input
            id="judge-email"
            type="email"
            autoComplete="off"
            spellCheck={false}
            placeholder="name@example.com"
            className={`${FIELD} w-full px-3`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="judge-type" className={`text-sm ${MUTED}`}>
            Type
          </label>
          <select
            id="judge-type"
            className={FIELD}
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            <option value="organizer">Organizer</option>
            {SPONSOR_TRACKS.map((track) => (
              <option key={track} value={track}>
                Sponsor: {track}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={BTN_DARK} disabled={add.isPending}>
          {add.isPending ? "Adding…" : "Add"}
        </button>
      </form>
      <StatusLine status={status} />
    </section>
  );
}
