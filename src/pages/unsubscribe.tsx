import type { GetServerSideProps } from "next";
import { useState } from "react";
import SEO from "~/components/seo";
import { tokenExists } from "~/server/subscribers";

// This page used to call unsubscribeByToken() inside getServerSideProps, which
// meant a plain GET unsubscribed the recipient. Link scanners fetch every URL in
// an incoming email, so Microsoft Defender Safe Links silently unsubscribed people
// who had not opened the message, let alone clicked anything.
//
// It was not theoretical. Of 497 unsubscribes on the HW13 announcement, 489
// happened within two minutes of that recipient's own send — before a human could
// plausibly have read the email. Eight were real.
//
// So: GET only looks the token up and renders a button. The write happens on POST
// to /api/unsubscribe, which a scanner will not issue. The RFC 8058 one-click path
// in that same handler already used POST and was never affected — Gmail and Apple
// Mail's built-in Unsubscribe button keeps working with no extra click.

type Props = { status: "ready" | "invalid" | "already" };

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const token = typeof ctx.query.token === "string" ? ctx.query.token : "";
  if (!token) return { props: { status: "invalid" } };

  // Read-only. Nothing on this request path may write.
  const state = await tokenExists(token);
  return { props: { status: state } };
};

export default function Unsubscribe({ status }: Props) {
  const [done, setDone] = useState(status === "already");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setBusy(true);
    setFailed(false);
    try {
      const token =
        new URLSearchParams(window.location.search).get("token") ?? "";
      const res = await fetch(
        `/api/unsubscribe?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
        },
      );
      if (!res.ok) throw new Error(String(res.status));
      setDone(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const invalid = status === "invalid";

  return (
    <>
      <SEO title="Unsubscribe" />
      <main className="flex min-h-screen flex-col items-center justify-center bg-offwhite px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/shared/emailbanner.png"
          alt="Hack Western"
          className="mb-8 w-full max-w-md rounded-lg"
        />

        <h1 className="font-cossetteTexte text-2xl font-bold text-heavy">
          {invalid
            ? "Invalid link"
            : done
              ? "You've been unsubscribed"
              : "Unsubscribe from Hack Western emails?"}
        </h1>

        <p className="mt-3 max-w-md font-figtree text-medium">
          {invalid
            ? "This unsubscribe link is missing or invalid."
            : done
              ? "You won't receive further Hack Western update emails at this address."
              : "You'll stop receiving Hack Western update emails at this address."}
        </p>

        {!invalid && !done && (
          <button
            onClick={confirm}
            disabled={busy}
            className="mt-6 rounded-lg bg-primary px-5 py-2 font-figtree text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Unsubscribing…" : "Confirm unsubscribe"}
          </button>
        )}

        {failed && (
          <p className="mt-3 max-w-md font-figtree text-sm text-red-600">
            That didn&apos;t go through. Try again, or reply to any of our
            emails and we&apos;ll take you off the list.
          </p>
        )}

        <a
          href="https://www.hackwestern.com"
          className="mt-6 rounded-lg bg-primary px-5 py-2 font-figtree text-primary-foreground"
        >
          Back to hackwestern.com
        </a>
      </main>
    </>
  );
}
