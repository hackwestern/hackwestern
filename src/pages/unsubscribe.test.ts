import { describe, expect, test, vi } from "vitest";
import { getServerSideProps } from "./unsubscribe";
import * as subs from "~/server/subscribers";

const ctx = (token?: string) =>
  ({ query: token ? { token } : {} }) as unknown as Parameters<
    typeof getServerSideProps
  >[0];

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
