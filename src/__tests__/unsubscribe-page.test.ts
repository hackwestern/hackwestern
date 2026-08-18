import { beforeEach, describe, expect, test, vi } from "vitest";
import { getServerSideProps } from "~/pages/unsubscribe";
import * as subs from "~/server/subscribers";

const ctx = (token?: string) =>
  ({ query: token ? { token } : {} }) as unknown as Parameters<
    typeof getServerSideProps
  >[0];

describe("unsubscribe getServerSideProps", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // THE IMPORTANT ONE. This page previously unsubscribed inside
  // getServerSideProps, so a plain GET was a write. Link scanners fetch every URL
  // in an incoming email, so Microsoft Defender silently unsubscribed people who
  // had never opened the message: 489 of 497 unsubscribes on the HW13 announcement
  // landed within two minutes of that recipient's own send.
  //
  // If this assertion ever fails, the bug is back.
  test("GET never writes — only the POST handler unsubscribes", async () => {
    const write = vi.spyOn(subs, "unsubscribeByToken").mockResolvedValue(true);
    vi.spyOn(subs, "tokenExists").mockResolvedValue("ready");

    await getServerSideProps(ctx("abc"));
    await getServerSideProps(ctx());
    await getServerSideProps(ctx("nope"));

    expect(write).not.toHaveBeenCalled();
  });

  test("valid unused token → ready, so the page offers the button", async () => {
    vi.spyOn(subs, "tokenExists").mockResolvedValue("ready");
    const res = await getServerSideProps(ctx("abc"));
    expect(res).toEqual({ props: { status: "ready" } });
  });

  test("already unsubscribed → already, so the page confirms instead of asking", async () => {
    vi.spyOn(subs, "tokenExists").mockResolvedValue("already");
    const res = await getServerSideProps(ctx("abc"));
    expect(res).toEqual({ props: { status: "already" } });
  });

  test("missing token → invalid, no DB call", async () => {
    const spy = vi.spyOn(subs, "tokenExists").mockResolvedValue("ready");
    const res = await getServerSideProps(ctx());
    expect(res).toEqual({ props: { status: "invalid" } });
    expect(spy).not.toHaveBeenCalled();
  });

  test("unknown token → invalid", async () => {
    vi.spyOn(subs, "tokenExists").mockResolvedValue("invalid");
    const res = await getServerSideProps(ctx("nope"));
    expect(res).toEqual({ props: { status: "invalid" } });
  });
});
