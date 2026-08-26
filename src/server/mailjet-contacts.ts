import type { MailjetCreds } from "~/server/mail-mailjet";

/**
 * Mailjet contact-list membership (v3 REST), as opposed to sending (v3.1).
 *
 * Why this exists: the Send API creates a contact as a side effect of sending
 * to it, but files it under no list. Mailjet's dashboard campaigns can only
 * target a *list*, so every contact we created by sending was invisible to
 * whoever composes the campaign. Everything that should be reachable from the
 * dashboard has to be put in a list explicitly, which is what this does.
 */

const BASE = "https://api.mailjet.com/v3/REST/contactslist";

/**
 * `addnoforce` adds the contact but leaves an existing subscription status
 * alone; `addforce` adds it AND resets `IsUnsubscribed` to false. Never default
 * to addforce — it silently resurrects people who opted out, which is the one
 * failure mode that turns a re-import into a compliance problem.
 */
export type ManageAction = "addnoforce" | "addforce" | "remove" | "unsub";

export interface ContactListInfo {
  id: number;
  name: string;
  subscriberCount: number;
}

export function authHeader(creds: MailjetCreds): string {
  return `Basic ${Buffer.from(`${creds.apiKey}:${creds.secretKey}`).toString(
    "base64",
  )}`;
}

interface ContactsListRow {
  ID?: number;
  Name?: string;
  SubscriberCount?: number;
}

/** Look a list up by ID. Used to fail loudly before writing to a wrong/dead list. */
export async function getContactList(
  listId: string,
  creds: MailjetCreds,
): Promise<ContactListInfo | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(listId)}`, {
    headers: { Authorization: authHeader(creds) },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `Mailjet contactslist GET ${res.status}: ${await res.text()}`,
    );
  }
  const json = (await res.json()) as { Data?: ContactsListRow[] };
  const row = json.Data?.[0];
  if (!row?.ID) return null;
  return {
    id: row.ID,
    name: row.Name ?? "",
    subscriberCount: row.SubscriberCount ?? 0,
  };
}

/**
 * Add (or unsubscribe/remove) one contact on one list.
 *
 * Never throws — callers include the signup path, where a Mailjet outage must
 * not fail a preregistration that is already committed to our own database.
 * Idempotent under `addnoforce`, so the backfill script is safe to re-run.
 */
export async function manageContact(
  listId: string,
  email: string,
  creds: MailjetCreds,
  action: ManageAction = "addnoforce",
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(listId)}/managecontact`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader(creds),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ Email: email, Action: action }),
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        error: `Mailjet managecontact ${res.status}: ${await res.text()}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
