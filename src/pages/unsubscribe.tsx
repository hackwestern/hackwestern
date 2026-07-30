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
