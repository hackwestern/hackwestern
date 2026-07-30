# HW11/12 Hacker Email Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import HW11/HW12 hacker emails into a new `email_subscribers` table and send them Hack Western 13 update emails in paced batches, each carrying a compliant one-click unsubscribe.

**Architecture:** New Drizzle table holds subscribers with provenance + unsubscribe/bounce/send-cursor state. A shared `unsubscribeByToken` function backs a GET/POST API route (`/api/unsubscribe`). A new `campaignTemplate` renders the per-recipient footer. Two `tsx` scripts — import (dumps → DB) and send (chunked, resumable). A scheduled Claude Code cloud routine runs the send script one chunk per fire.

**Tech Stack:** Next.js 15 (pages router), Drizzle ORM (Postgres), tRPC (existing), Vitest, `tsx` + `dotenv-cli` for scripts, Cloudflare Email Sending REST (`sendEmail` in `src/server/mail.ts`).

**Spec:** `docs/specs/2026-07-30-hacker-email-campaign-design.md`

**Note on plan path:** the skill default `docs/superpowers/plans/` is gitignored in this repo; this plan lives in `docs/plans/` alongside the committed spec in `docs/specs/`.

## Global Constraints

- **Consent scope:** HW11 + HW12 only. No older editions.
- **Exclude `.edu` / school domains** entirely (`.edu`, `.ac.*`, and known CA university domains: `uwo.ca`, `uwaterloo.ca`, `mcmaster.ca`, `utoronto.ca`/`mail.utoronto.ca`, `yorku.ca`, `queensu.ca`, `ualberta.ca`, `ubc.ca`, `mcgill.ca`, `carleton.ca`, `uottawa.ca`, `torontomu.ca`, `sheridancollege.ca`).
- **Emails stored lowercased + trimmed.** `email` column is `UNIQUE`. One send per address, ever (dedup + `last_sent_at` cursor).
- **Footer copy (verbatim):** `You're receiving this at {email} because you subscribed to Hack Western {edition}.` where `{edition}` is `11` or `12` derived from `source`. Plus an `Unsubscribe` link and `hackwestern.com`. **No postal address.**
- **Sender:** `Hack Western Team <hello@hackwestern.com>` (matches existing).
- **Cloudflare cap:** never exceed 1000 sends/day; target rate is well under it (ramp: ~200 → ~400 → ~600–800/day).
- **`sendEmail` can return HTTP 200 with `success:false`** — always check the returned `error`.
- **Scripts run via** `npx dotenv -- tsx ./scripts/<name>.ts` (the `--` is required or `dotenv` swallows script flags). Dry-run default; `--send`/`--commit` to act.
- Follow existing patterns: token style from `src/server/api/routers/auth.ts` (`randomBytes(20).toString("hex")`); Vitest DB tests use `createInnerTRPCContext` + `createCaller`.

---

## File Structure

- `src/server/db/schema.ts` — add `emailSubscribers` table (modify).
- `drizzle/00XX_*.sql` + `drizzle/meta/*` — generated migration (create).
- `src/server/subscribers.ts` — core subscriber logic: token gen, `unsubscribeByToken`, email normalization + `.edu` classifier (create).
- `src/server/subscribers.test.ts` — unit tests for normalization/classifier/token (create).
- `src/server/api/routers/email-templates.ts` — add `campaignTemplate` (modify).
- `src/server/api/routers/email-templates.test.ts` — test `campaignTemplate` footer (create).
- `src/pages/unsubscribe.tsx` — on-brand confirmation page; unsubscribe runs in `getServerSideProps` (create).
- `src/pages/unsubscribe.test.ts` — `getServerSideProps` tests (create).
- `src/pages/api/unsubscribe.ts` — POST one-click (RFC 8058) + GET → redirect to the page (create).
- `src/pages/api/unsubscribe.test.ts` — route handler tests (create).
- `scripts/import-subscribers.ts` — dumps → `email_subscribers` (create).
- `scripts/import-subscribers.test.ts` — pure-transform tests (create).
- `scripts/send-campaign.ts` — chunked paced send (create).
- `scripts/send-campaign.test.ts` — selection/render tests (create).
- `docs/runbooks/hacker-email-campaign.md` — operator runbook + cloud-routine setup (create).

---

## Task 1: `email_subscribers` table + migration

**Files:**
- Modify: `src/server/db/schema.ts` (add table near `preregistrations`, ~line 247)
- Create: migration via `db:generate`
- Test: `src/server/subscribers.test.ts` (schema-shape smoke — full logic tests in Task 2)

**Interfaces:**
- Produces: `emailSubscribers` Drizzle table with columns `id, email, source, unsubscribeToken, unsubscribedAt, bouncedAt, lastSentAt, createdAt`.

- [ ] **Step 1: Add the table to `schema.ts`**

Append after the `preregistrations` table definition:

```ts
export const emailSubscribers = pgTable("email_subscriber", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).unique().notNull(),
  source: varchar("source", { length: 16 }).notNull(), // 'hw11' | 'hw12'
  unsubscribeToken: varchar("unsubscribe_token", { length: 64 })
    .unique()
    .notNull(),
  unsubscribedAt: timestamp("unsubscribed_at", { mode: "date", precision: 3 }),
  bouncedAt: timestamp("bounced_at", { mode: "date", precision: 3 }),
  lastSentAt: timestamp("last_sent_at", { mode: "date", precision: 3 }),
  createdAt: timestamp("created_at", { mode: "date", precision: 3 })
    .defaultNow()
    .notNull(),
});
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: a new `drizzle/00XX_*.sql` creating `email_subscriber` with the unique constraints on `email` and `unsubscribe_token`. Inspect the SQL to confirm no unintended changes to other tables.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep schema.ts`
Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat: add email_subscribers table + migration"
```

> Migration is applied to prod later, in the runbook (Task 8), not here.

---

## Task 2: Core subscriber logic — normalize, classify, token, unsubscribe

**Files:**
- Create: `src/server/subscribers.ts`
- Create: `src/server/subscribers.test.ts`

**Interfaces:**
- Consumes: `emailSubscribers` (Task 1), `db` from `~/server/db`.
- Produces:
  - `normalizeEmail(raw: string): string` — trim + lowercase; gmail dot/`+tag` canonicalization for `gmail.com`/`googlemail.com`.
  - `isSchoolEmail(email: string): boolean` — true for `.edu`, `.ac.*`, known CA university domains.
  - `generateUnsubscribeToken(): string` — `randomBytes(20).toString("hex")`.
  - `editionFromSource(source: string): string` — `'hw11'→'11'`, `'hw12'→'12'`.
  - `unsubscribeByToken(token: string): Promise<boolean>` — sets `unsubscribedAt` if a matching row exists and isn't already unsubscribed; returns whether a subscriber matched.

- [ ] **Step 1: Write the failing tests**

```ts
// src/server/subscribers.test.ts
import { describe, expect, test } from "vitest";
import {
  normalizeEmail,
  isSchoolEmail,
  generateUnsubscribeToken,
  editionFromSource,
} from "./subscribers";

describe("normalizeEmail", () => {
  test("trims + lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
  test("canonicalizes gmail dots and +tags", () => {
    expect(normalizeEmail("john.doe+hw@gmail.com")).toBe("johndoe@gmail.com");
    expect(normalizeEmail("JohnDoe@googlemail.com")).toBe("johndoe@googlemail.com");
  });
  test("leaves non-gmail local part intact", () => {
    expect(normalizeEmail("john.doe@outlook.com")).toBe("john.doe@outlook.com");
  });
});

describe("isSchoolEmail", () => {
  test.each([
    ["a@smith.edu", true],
    ["b@uwo.ca", true],
    ["c@mail.utoronto.ca", true],
    ["d@uwaterloo.ca", true],
    ["e@ox.ac.uk", true],
    ["f@gmail.com", false],
    ["g@autodesk.com", false],
  ])("%s -> %s", (email, expected) => {
    expect(isSchoolEmail(email)).toBe(expected);
  });
});

describe("generateUnsubscribeToken", () => {
  test("returns 40-char hex, unique per call", () => {
    const a = generateUnsubscribeToken();
    const b = generateUnsubscribeToken();
    expect(a).toMatch(/^[0-9a-f]{40}$/);
    expect(a).not.toBe(b);
  });
});

describe("editionFromSource", () => {
  test.each([
    ["hw11", "11"],
    ["hw12", "12"],
  ])("%s -> %s", (s, e) => expect(editionFromSource(s)).toBe(e));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/server/subscribers.test.ts`
Expected: FAIL — module `./subscribers` not found.

- [ ] **Step 3: Implement `src/server/subscribers.ts`**

```ts
import { randomBytes } from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";

const SCHOOL_DOMAINS = new Set([
  "uwo.ca", "uwaterloo.ca", "mcmaster.ca", "utoronto.ca", "mail.utoronto.ca",
  "yorku.ca", "queensu.ca", "ualberta.ca", "ubc.ca", "mcgill.ca",
  "carleton.ca", "uottawa.ca", "torontomu.ca", "sheridancollege.ca",
]);

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    const canonical = local.split("+")[0]!.replace(/\./g, "");
    return `${canonical}@${domain}`;
  }
  return email;
}

export function isSchoolEmail(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  if (domain.endsWith(".edu")) return true;
  if (/\.ac\.[a-z]{2,}$/.test(domain)) return true;
  return SCHOOL_DOMAINS.has(domain);
}

export function generateUnsubscribeToken(): string {
  return randomBytes(20).toString("hex");
}

export function editionFromSource(source: string): string {
  return source.replace(/^hw/, "");
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const rows = await db
    .update(emailSubscribers)
    .set({ unsubscribedAt: new Date() })
    .where(
      and(
        eq(emailSubscribers.unsubscribeToken, token),
        isNull(emailSubscribers.unsubscribedAt),
      ),
    )
    .returning({ id: emailSubscribers.id });
  if (rows.length > 0) return true;
  // token exists but already unsubscribed => still a success (idempotent)
  const existing = await db.query.emailSubscribers.findFirst({
    where: eq(emailSubscribers.unsubscribeToken, token),
    columns: { id: true },
  });
  return !!existing;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/server/subscribers.test.ts`
Expected: PASS (the four pure-function describe blocks). `unsubscribeByToken` is covered in Task 4 via the route test.

- [ ] **Step 5: Commit**

```bash
git add src/server/subscribers.ts src/server/subscribers.test.ts
git commit -m "feat: subscriber normalization, school classifier, unsubscribe logic"
```

---

## Task 3: `campaignTemplate` email

**Files:**
- Modify: `src/server/api/routers/email-templates.ts`
- Create: `src/server/api/routers/email-templates.test.ts`

**Interfaces:**
- Consumes: existing `bannerUrl` + MJML skeleton in the file.
- Produces: `campaignTemplate(email: string, edition: string, unsubscribeUrl: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/api/routers/email-templates.test.ts
import { describe, expect, test } from "vitest";
import { campaignTemplate } from "./email-templates";

describe("campaignTemplate", () => {
  const html = campaignTemplate(
    "person@gmail.com",
    "12",
    "https://hackwestern.com/api/unsubscribe?token=abc",
  );
  test("includes per-recipient footer with email + edition", () => {
    expect(html).toContain("person@gmail.com");
    expect(html).toContain("because you subscribed to Hack Western 12");
  });
  test("includes the unsubscribe link", () => {
    expect(html).toContain("https://hackwestern.com/api/unsubscribe?token=abc");
    expect(html.toLowerCase()).toContain(">unsubscribe<");
  });
  test("does not contain a postal address block", () => {
    expect(html).not.toMatch(/\bN6A\b/); // Western's postal code, sanity guard
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/server/api/routers/email-templates.test.ts`
Expected: FAIL — `campaignTemplate` is not exported.

- [ ] **Step 3: Implement `campaignTemplate`**

Add to `email-templates.ts` (reuse the same MJML skeleton as `signupTemplate`; body paragraph is the campaign intro, footer carries the compliance line). Append:

```ts
export const campaignTemplate = (
  email: string,
  edition: string,
  unsubscribeUrl: string,
) =>
  `<div style="word-spacing:normal;background-color:#f4f4f4"><div style="background-color:#f4f4f4"><div style="margin:0px auto;max-width:600px"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%"><tbody><tr><td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center"><div style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top" width="100%"><tbody><tr><td style="width:600px"><a href="https://www.hackwestern.com" target="_blank"><img alt="Hack Western 13 Banner" src="${bannerUrl}" style="border:none;display:block;outline:none;text-decoration:none;height:auto;width:100%;font-size:13px" width="600" height="auto"></a></td></tr></tbody></table></div></td></tr></tbody></table></div><div style="background:#ffffff;margin:0px auto;max-width:600px"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;width:100%"><tbody><tr><td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center"><div style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top" width="100%"><tbody><tr><td align="left" style="font-size:0px;padding:0px 25px;word-break:break-word"><div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;text-align:left;color:#000000"><p style="margin:16px 0"><span style="color:#55575d;font-family:Verdana,Helvetica,Arial,sans-serif;font-size:13px">Hi there!</span></p><p style="margin:16px 0"><span style="color:#55575d;font-family:Verdana,Helvetica,Arial,sans-serif;font-size:13px">Hack Western 13 is on the way. We'll keep you posted with important announcements, application openings, and everything you need to know as we get closer to the event. 🐎</span></p></div></td></tr></tbody></table></div></td></tr></tbody></table></div><div style="margin:0px auto;max-width:600px"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%"><tbody><tr><td style="direction:ltr;font-size:0px;padding:16px 25px;text-align:center"><div style="font-family:Arial,sans-serif;font-size:11px;line-height:1.6;text-align:center;color:#8a8c92"><span>You're receiving this at ${email} because you subscribed to Hack Western ${edition}.</span><br/><a href="${unsubscribeUrl}" style="color:#8a8c92;text-decoration:underline">Unsubscribe</a> · <a href="https://www.hackwestern.com" style="color:#8a8c92;text-decoration:underline">hackwestern.com</a></div></td></tr></tbody></table></div></div></div>`;
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/server/api/routers/email-templates.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/api/routers/email-templates.ts src/server/api/routers/email-templates.test.ts
git commit -m "feat: campaign email template with compliant footer + unsubscribe"
```

---

## Task 4: On-brand unsubscribe page + one-click API route

Two files: a styled Next.js page that performs the unsubscribe server-side and confirms it using Hack Western's design tokens, and an API route that serves the RFC 8058 one-click POST (for the `List-Unsubscribe` header) and redirects GETs to the page.

**Files:**
- Create: `src/pages/unsubscribe.tsx`
- Create: `src/pages/unsubscribe.test.ts`
- Create: `src/pages/api/unsubscribe.ts`
- Create: `src/pages/api/unsubscribe.test.ts`

**Interfaces:**
- Consumes: `unsubscribeByToken` (Task 2); `SEO` from `~/components/seo`.
- Produces:
  - Page at `/unsubscribe?token=…` — `getServerSideProps` calls `unsubscribeByToken(token)` and returns `{ status: "ok" | "invalid" }`; the component renders an on-brand confirmation (or invalid-link) screen. This is the URL used in the visible email footer link.
  - API `POST /api/unsubscribe?token=…` — one-click unsubscribe → `200`/`404`. `GET` → `307` redirect to `/unsubscribe?token=…`. This URL is used in the `List-Unsubscribe` header.

**Design tokens to use (verbatim Tailwind classes that exist in this repo):** `bg-offwhite` (page bg), `text-heavy` / `text-medium` (text), `bg-primary` + `text-primary-foreground` (button), `font-cossetteTexte` (heading), `font-figtree` (body), `rounded-lg` (0.5rem radius). Banner image served at `/shared/emailbanner.png`.

### 4a — the page

- [ ] **Step 1: Write the failing test**

```ts
// src/pages/unsubscribe.test.ts
import { describe, expect, test, vi } from "vitest";
import { getServerSideProps } from "./unsubscribe";
import * as subs from "~/server/subscribers";

const ctx = (token?: string) =>
  ({ query: token ? { token } : {} }) as unknown as Parameters<typeof getServerSideProps>[0];

describe("unsubscribe getServerSideProps", () => {
  test("valid token → status ok", async () => {
    vi.spyOn(subs, "unsubscribeByToken").mockResolvedValue(true);
    const res = await getServerSideProps(ctx("abc"));
    expect(res).toEqual({ props: { status: "ok" } });
  });

  test("missing token → invalid, no DB call", async () => {
    const spy = vi.spyOn(subs, "unsubscribeByToken").mockResolvedValue(true);
    const res = await getServerSideProps(ctx());
    expect(res).toEqual({ props: { status: "invalid" } });
    expect(spy).not.toHaveBeenCalled();
  });

  test("unknown token → invalid", async () => {
    vi.spyOn(subs, "unsubscribeByToken").mockResolvedValue(false);
    const res = await getServerSideProps(ctx("nope"));
    expect(res).toEqual({ props: { status: "invalid" } });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/pages/unsubscribe.test.ts`
Expected: FAIL — `./unsubscribe` not found.

- [ ] **Step 3: Implement the page**

```tsx
// src/pages/unsubscribe.tsx
import type { GetServerSideProps } from "next";
import SEO from "~/components/seo";
import { unsubscribeByToken } from "~/server/subscribers";

type Props = { status: "ok" | "invalid" };

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const token = typeof ctx.query.token === "string" ? ctx.query.token : "";
  if (!token) return { props: { status: "invalid" } };
  const matched = await unsubscribeByToken(token);
  return { props: { status: matched ? "ok" : "invalid" } };
};

export default function Unsubscribe({ status }: Props) {
  const ok = status === "ok";
  return (
    <>
      <SEO title="Unsubscribe | Hack Western" />
      <main className="flex min-h-screen flex-col items-center justify-center bg-offwhite px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/shared/emailbanner.png"
          alt="Hack Western"
          className="mb-8 w-full max-w-md rounded-lg"
        />
        <h1 className="font-cossetteTexte text-2xl font-bold text-heavy">
          {ok ? "You've been unsubscribed" : "Invalid link"}
        </h1>
        <p className="font-figtree mt-3 max-w-md text-medium">
          {ok
            ? "You won't receive further Hack Western update emails at this address."
            : "This unsubscribe link is missing or invalid."}
        </p>
        <a
          href="https://www.hackwestern.com"
          className="font-figtree mt-6 rounded-lg bg-primary px-5 py-2 text-primary-foreground"
        >
          Back to hackwestern.com
        </a>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/pages/unsubscribe.test.ts`
Expected: PASS (3 tests). Then `npx tsc --noEmit -p tsconfig.json 2>&1 | grep unsubscribe` → no output. If any Tailwind class above doesn't exist in `tailwind.config.ts`, STOP and report — do not invent classes.

### 4b — the one-click API route

- [ ] **Step 5: Write the failing test**

```ts
// src/pages/api/unsubscribe.test.ts
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "./unsubscribe";
import * as subs from "~/server/subscribers";

function mockRes() {
  const res = {} as NextApiResponse & {
    _status?: number; _redirect?: string; _headers: Record<string, string>;
  };
  res._headers = {};
  res.status = vi.fn(function (this: typeof res, c: number) { this._status = c; return this; }) as never;
  res.setHeader = vi.fn(function (this: typeof res, k: string, v: string) { this._headers[k] = v; return this; }) as never;
  res.redirect = vi.fn(function (this: typeof res, code: number, url: string) { this._status = code; this._redirect = url; return this; }) as never;
  res.end = vi.fn(function (this: typeof res) { return this; }) as never;
  return res;
}

describe("/api/unsubscribe", () => {
  beforeEach(() => vi.restoreAllMocks());

  test("POST with valid token unsubscribes + returns 200", async () => {
    const spy = vi.spyOn(subs, "unsubscribeByToken").mockResolvedValue(true);
    const req = { method: "POST", query: { token: "xyz" }, body: {} } as unknown as NextApiRequest;
    const res = mockRes();
    await handler(req, res);
    expect(spy).toHaveBeenCalledWith("xyz");
    expect(res._status).toBe(200);
  });

  test("POST with missing token returns 400", async () => {
    const req = { method: "POST", query: {}, body: {} } as unknown as NextApiRequest;
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  test("GET redirects (307) to the /unsubscribe page with the token", async () => {
    const req = { method: "GET", query: { token: "abc" } } as unknown as NextApiRequest;
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(307);
    expect(res._redirect).toBe("/unsubscribe?token=abc");
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/pages/api/unsubscribe.test.ts`
Expected: FAIL — `./unsubscribe` not found.

- [ ] **Step 7: Implement the route**

```ts
// src/pages/api/unsubscribe.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { unsubscribeByToken } from "~/server/subscribers";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token =
    (req.query.token as string | undefined) ??
    (typeof req.body === "object" && req.body
      ? ((req.body as Record<string, unknown>).token as string | undefined)
      : undefined);

  // RFC 8058 one-click unsubscribe (used by the List-Unsubscribe header).
  if (req.method === "POST") {
    if (!token) return res.status(400).end();
    const matched = await unsubscribeByToken(token);
    return res.status(matched ? 200 : 404).end();
  }

  // GET (someone opened the header URL in a browser) → the on-brand page,
  // which performs + confirms the unsubscribe.
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return res.redirect(307, `/unsubscribe${q}`);
}
```

- [ ] **Step 8: Run to verify pass**

Run: `npx vitest run src/pages/api/unsubscribe.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add src/pages/unsubscribe.tsx src/pages/unsubscribe.test.ts src/pages/api/unsubscribe.ts src/pages/api/unsubscribe.test.ts
git commit -m "feat: on-brand unsubscribe page + one-click API route"
```

---

## Task 5: Import script (dumps → `email_subscribers`)

**Files:**
- Create: `scripts/import-subscribers.ts`
- Create: `scripts/import-subscribers.test.ts`

**Interfaces:**
- Consumes: `normalizeEmail`, `isSchoolEmail`, `generateUnsubscribeToken` (Task 2); `emailSubscribers`, `db`.
- Produces: `buildSubscriberRows(sources: { emails: string[]; source: string }[]): { email: string; source: string }[]` — pure: normalize, drop school + junk, apply typo fixes, dedup (hw12 wins on overlap). The DB insert + dump extraction are I/O wrappers around it.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/import-subscribers.test.ts
import { describe, expect, test } from "vitest";
import { buildSubscriberRows, DOMAIN_FIXES } from "./import-subscribers";

describe("buildSubscriberRows", () => {
  test("normalizes, dedups, hw12 wins on overlap", () => {
    const rows = buildSubscriberRows([
      { emails: ["A@gmail.com", "x@outlook.com"], source: "hw11" },
      { emails: ["a@gmail.com"], source: "hw12" }, // same person, newer
    ]);
    const a = rows.find((r) => r.email === "a@gmail.com");
    expect(a?.source).toBe("hw12");
    expect(rows).toHaveLength(2);
  });

  test("drops school + junk, keeps freemail", () => {
    const rows = buildSubscriberRows([
      { emails: ["stu@uwo.ca", "junk@t1.com", "ok@gmail.com"], source: "hw12" },
    ]);
    expect(rows.map((r) => r.email)).toEqual(["ok@gmail.com"]);
  });

  test("applies domain typo fixes", () => {
    expect(DOMAIN_FIXES["gmaill.com"]).toBe("gmail.com");
    const rows = buildSubscriberRows([
      { emails: ["typo@gmaill.com"], source: "hw11" },
    ]);
    expect(rows[0]?.email).toBe("typo@gmail.com");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/import-subscribers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/import-subscribers.ts`**

```ts
import { normalizeEmail, isSchoolEmail, generateUnsubscribeToken } from "~/server/subscribers";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";

export const DOMAIN_FIXES: Record<string, string> = {
  "gmaill.com": "gmail.com", "outlook.con": "outlook.com", "uwo.com": "uwo.ca",
  "uwaterloo.caq": "uwaterloo.ca", "sheidancollege.ca": "sheridancollege.ca",
  "mail.utoronto.com": "mail.utoronto.ca", "mail.utoronto": "mail.utoronto.ca",
};
const JUNK = new Set([
  "t1.com", "example.com", "test.com", "email.com",
  "ajfoij.cwe", "fhuef.fhuio", "s.com", "racetoacure.org", "hackwestern.ca",
]);

function fixDomain(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return DOMAIN_FIXES[domain] ? `${local}@${DOMAIN_FIXES[domain]}` : email;
}

export function buildSubscriberRows(
  sources: { emails: string[]; source: string }[],
): { email: string; source: string }[] {
  // hw12 should win on overlap: process hw11 first, then hw12 overwrites.
  const order = [...sources].sort((a, b) => a.source.localeCompare(b.source));
  const map = new Map<string, string>(); // email -> source
  for (const { emails, source } of order) {
    for (const raw of emails) {
      const email = normalizeEmail(fixDomain(normalizeEmail(raw)));
      const domain = email.split("@")[1] ?? "";
      if (!email.includes("@") || JUNK.has(domain)) continue;
      if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) continue;
      if (isSchoolEmail(email)) continue;
      map.set(email, source);
    }
  }
  return [...map.entries()].map(([email, source]) => ({ email, source }));
}

// --- I/O wrapper (not unit-tested; exercised via dry-run) ---
async function main() {
  const COMMIT = process.argv.includes("--commit");
  // Emails are extracted upstream from the restored dumps into these files,
  // one email per line (see runbook Task 8, step "extract emails").
  const fs = await import("fs");
  const read = (p: string) =>
    fs.existsSync(p) ? fs.readFileSync(p, "utf8").split("\n").map((s) => s.trim()).filter(Boolean) : [];
  const rows = buildSubscriberRows([
    { emails: read("/tmp/hw11-emails.txt"), source: "hw11" },
    { emails: read("/tmp/hw12-emails.txt"), source: "hw12" },
  ]);
  console.log(`Prepared ${rows.length} subscriber rows.`);
  if (!COMMIT) {
    console.log("Dry run. Re-run with --commit to insert.");
    return;
  }
  let inserted = 0;
  for (const r of rows) {
    const done = await db
      .insert(emailSubscribers)
      .values({ ...r, unsubscribeToken: generateUnsubscribeToken() })
      .onConflictDoNothing({ target: emailSubscribers.email })
      .returning({ id: emailSubscribers.id });
    if (done.length) inserted++;
  }
  console.log(`Inserted ${inserted} new, skipped ${rows.length - inserted} existing.`);
}

if (process.argv[1]?.includes("import-subscribers")) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run scripts/import-subscribers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/import-subscribers.ts scripts/import-subscribers.test.ts
git commit -m "feat: subscriber import script (dumps -> email_subscribers)"
```

---

## Task 6: Send script (chunked, paced, bounce-aware)

**Files:**
- Create: `scripts/send-campaign.ts`
- Create: `scripts/send-campaign.test.ts`

**Interfaces:**
- Consumes: `editionFromSource` (Task 2), `campaignTemplate` (Task 3), `sendEmail` (`~/server/mail`), `emailSubscribers`, `db`, `env` for the base URL.
- Produces:
  - `unsubscribeUrl(token: string): string` — `${BASE}/unsubscribe?token=${token}` (the on-brand page; used as the visible footer link).
  - `unsubscribePostUrl(token: string): string` — `${BASE}/api/unsubscribe?token=${token}` (the one-click POST endpoint; used in the `List-Unsubscribe` header).
  - `renderFor(sub): { subject, html, headers }` — builds the per-recipient email: `html` links the footer to `unsubscribeUrl`; `List-Unsubscribe` header wraps `unsubscribePostUrl` with `List-Unsubscribe-Post`.
  - `selectChunkQuery(chunkSize, campaignStart)` — the Drizzle query (unsubscribed/bounced/already-sent excluded). The main loop sends one chunk and updates `lastSentAt`/`bouncedAt`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/send-campaign.test.ts
import { describe, expect, test } from "vitest";
import { unsubscribeUrl, renderFor } from "./send-campaign";

describe("send-campaign helpers", () => {
  test("unsubscribeUrl builds the /unsubscribe page link", () => {
    expect(unsubscribeUrl("tok123")).toContain("/unsubscribe?token=tok123");
    expect(unsubscribeUrl("tok123")).not.toContain("/api/unsubscribe");
  });

  test("renderFor sets subject, per-recipient footer, and one-click headers", () => {
    const r = renderFor({
      email: "p@gmail.com",
      source: "hw12",
      unsubscribeToken: "tok123",
    });
    expect(r.subject).toMatch(/Hack Western 13/i);
    expect(r.html).toContain("because you subscribed to Hack Western 12");
    expect(r.html).toContain("p@gmail.com");
    expect(r.headers["List-Unsubscribe"]).toContain("/api/unsubscribe?token=tok123");
    expect(r.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/send-campaign.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/send-campaign.ts`**

```ts
import { and, isNull, or, lt, asc } from "drizzle-orm";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";
import { sendEmail } from "~/server/mail";
import { campaignTemplate, } from "~/server/api/routers/email-templates";
import { editionFromSource } from "~/server/subscribers";
import { env } from "~/env";

const BASE = env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://www.hackwestern.com";
const SUBJECT = "Hack Western 13 is coming!";
const DELAY_MS = 500;

type Sub = { email: string; source: string; unsubscribeToken: string };

export function unsubscribeUrl(token: string): string {
  return `${BASE}/unsubscribe?token=${token}`;
}

export function unsubscribePostUrl(token: string): string {
  return `${BASE}/api/unsubscribe?token=${token}`;
}

export function renderFor(sub: Sub) {
  const pageUrl = unsubscribeUrl(sub.unsubscribeToken); // visible footer link
  const postUrl = unsubscribePostUrl(sub.unsubscribeToken); // one-click header
  return {
    subject: SUBJECT,
    html: campaignTemplate(sub.email, editionFromSource(sub.source), pageUrl),
    headers: {
      "List-Unsubscribe": `<${postUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    } as Record<string, string>,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const SEND = process.argv.includes("--send");
  const chunk = Number(process.argv.find((a) => a.startsWith("--chunk="))?.split("=")[1] ?? 75);
  const campaignStart = new Date(
    process.argv.find((a) => a.startsWith("--start="))?.split("=")[1] ?? "2026-08-01T00:00:00Z",
  );

  const rows = (await db
    .select({
      email: emailSubscribers.email,
      source: emailSubscribers.source,
      unsubscribeToken: emailSubscribers.unsubscribeToken,
      id: emailSubscribers.id,
    })
    .from(emailSubscribers)
    .where(
      and(
        isNull(emailSubscribers.unsubscribedAt),
        isNull(emailSubscribers.bouncedAt),
        or(isNull(emailSubscribers.lastSentAt), lt(emailSubscribers.lastSentAt, campaignStart)),
      ),
    )
    .orderBy(asc(emailSubscribers.id))
    .limit(chunk)) as (Sub & { id: number })[];

  console.log(`Chunk: ${rows.length} recipient(s). Mode: ${SEND ? "SEND" : "DRY RUN"}.`);
  if (!SEND) { rows.forEach((r, i) => console.log(`${i + 1}. ${r.email}`)); return; }

  let sent = 0, bounced = 0, failed = 0;
  for (const r of rows) {
    const { subject, html, headers } = renderFor(r);
    const { data, error } = await sendEmail({
      from: "Hack Western Team <hello@hackwestern.com>",
      to: r.email, subject, html, headers,
    });
    if (error) {
      failed++;
      console.log(`FAIL ${r.email} — ${error.message}`);
      if (/quota|rate|429/i.test(error.message)) { console.log("Quota/rate hit — stopping early."); break; }
    } else if (data && data.bounced.length) {
      bounced++;
      await db.update(emailSubscribers).set({ bouncedAt: new Date() }).where(eq(emailSubscribers.id, r.id));
      console.log(`BOUNCE ${r.email}`);
    } else {
      sent++;
      await db.update(emailSubscribers).set({ lastSentAt: new Date() }).where(eq(emailSubscribers.id, r.id));
      console.log(`ok ${r.email}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`Done. sent ${sent}, bounced ${bounced}, failed ${failed}.`);
}

// eq is needed in main(); import it alongside the others:
import { eq } from "drizzle-orm";

if (process.argv[1]?.includes("send-campaign")) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run scripts/send-campaign.test.ts`
Expected: PASS (2 tests). Then `npx tsc --noEmit -p tsconfig.json 2>&1 | grep send-campaign` → no output.

- [ ] **Step 5: Commit**

```bash
git add scripts/send-campaign.ts scripts/send-campaign.test.ts
git commit -m "feat: chunked paced campaign send script"
```

---

## Task 7: Full suite green + PR

**Files:** none (verification).

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: all pass, including the new subscriber/template/route/script tests.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 3: Push + open PR to `dev`**

```bash
git push -u origin feat/hacker-email-campaign
```
PR body: link the spec, list the table/route/scripts, note migration + cloud-routine setup happen at rollout (runbook), nothing sends on merge.

---

## Task 8: Operator runbook + cloud routine (rollout, run by owner)

**Files:**
- Create: `docs/runbooks/hacker-email-campaign.md`

This task documents the manual rollout — it is executed by the owner with prod access, not by the build agent. The runbook must contain:

- [ ] **Step 1: Write the runbook** covering, in order:

1. **Apply migration to prod:** `DATABASE_URL=<prod> npm run db:migrate` (or the project's prod migration path). Confirm `email_subscriber` exists.
2. **Deploy** the branch so `/unsubscribe` (page) and `/api/unsubscribe` (one-click) are live **before any send**. Verify by opening `/unsubscribe?token=deadbeef` → on-brand "Invalid link" page.
3. **Extract emails from dumps** into `/tmp/hw11-emails.txt` and `/tmp/hw12-emails.txt` (one per line):
   - `pg_restore -f /tmp/hw11.sql "hw_11_db (1).dump"`; `pg_restore -f /tmp/hw12.sql hw12_dump.dump`; keep the plain `hw12.dump` as-is.
   - Extract from the hacker-bearing tables' email columns (`user`, `application`) — inspect the restored SQL to confirm column names; grep the email regex from those `COPY` blocks. (Domain-level validation already done: `~/repos/db-dumps` → 5,113 unique, 0 dead domains; ~4,045 after `.edu` drop.)
4. **Import (dry run then commit):**
   `npx dotenv -- tsx ./scripts/import-subscribers.ts` then `… --commit` with prod `DATABASE_URL` inline. Confirm row count ≈ 4,045.
5. **Owner test-send:** temporarily insert your own address (source `hw12`), run `npx dotenv -- tsx ./scripts/send-campaign.ts --send --chunk=1`, confirm the email renders and that clicking **Unsubscribe** flips `unsubscribed_at` (re-query the row).
6. **Schedule the cloud routine** (use the `schedule` skill / routines):
   - Cron: every ~45 min within a 9am–7pm window.
   - Command per fire: `npx dotenv -- tsx ./scripts/send-campaign.ts --send --chunk=<ramped n> --start=<campaignStart ISO>`.
   - Ramp `<n>` up over days (≈200 → 400 → 600–800/day; keep total < 1000/day).
   - **Env in the routine:** prod `DATABASE_URL`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN`, `NEXTAUTH_URL` — provisioned in routine config, never committed.
   - Guardrail: routine prompt = run the one command, report the chunk log, stop.
7. **Monitor daily:** watch bounce/fail counts; the script auto-stops on quota/rate errors. Stop the routine when a run reports 0 recipients (list drained).

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/hacker-email-campaign.md
git commit -m "docs: rollout runbook for hacker email campaign"
```

---

## Self-Review Notes

- **Spec coverage:** data model → T1; normalization/dedup/single-send + token + `.edu` exclusion → T2/T5; instant one-click unsubscribe + `List-Unsubscribe` headers → T2/T4/T6; template footer (edition #, no address) → T3; chunked/paced/bounce-aware send → T6; cloud-routine execution + secrets → T8; import from dumps (typo-fix) → T5/T8; test-to-self before batches → T8.
- **Single-send guarantee:** unique `email` (T1) + `onConflictDoNothing` (T5) + cursor query excluding `lastSentAt >= start`, `unsubscribedAt`, `bouncedAt` (T6).
- **Types:** `buildSubscriberRows`/`DOMAIN_FIXES` (T5), `renderFor`/`unsubscribeUrl` (T6), `unsubscribeByToken`/`normalizeEmail`/`isSchoolEmail`/`editionFromSource`/`generateUnsubscribeToken` (T2), `campaignTemplate(email, edition, unsubscribeUrl)` (T3) — names consistent across consumers.
- **Deferred to runbook (needs prod/secrets, not build-agent work):** migration apply, dump extraction, import commit, cloud-routine scheduling.
