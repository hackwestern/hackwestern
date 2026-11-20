import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  DIRECTORY_TTL_MS,
  directoryEntry,
  getSlackDirectory,
  matchSlackUser,
  resetSlackDirectoryCache,
  type SlackDirectoryUser,
} from "~/server/slack/directory";

beforeEach(() => resetSlackDirectoryCache());

describe("directoryEntry", () => {
  test("collects first, real and display names, lowercased", () => {
    expect(
      directoryEntry({
        id: "U1",
        real_name: "Noah  Lee",
        profile: { first_name: "Noah", display_name: "noahl" },
      }),
    ).toEqual({ id: "U1", names: ["noah", "noah lee", "noahl"] });
  });

  test("falls back to the first word of the real name", () => {
    expect(directoryEntry({ id: "U1", real_name: "Caroline Chen" })).toEqual({
      id: "U1",
      names: ["caroline", "caroline chen"],
    });
  });

  test("skips bots, deactivated users, guests and Slackbot", () => {
    const base = { real_name: "Noah" };
    expect(directoryEntry({ ...base, id: "U1", deleted: true })).toBeNull();
    expect(directoryEntry({ ...base, id: "U1", is_bot: true })).toBeNull();
    expect(directoryEntry({ ...base, id: "U1", is_restricted: true })).toBeNull();
    expect(
      directoryEntry({ ...base, id: "U1", is_ultra_restricted: true }),
    ).toBeNull();
    expect(directoryEntry({ ...base, id: "USLACKBOT" })).toBeNull();
  });
});

describe("matchSlackUser", () => {
  const dir: SlackDirectoryUser[] = [
    { id: "UNOAH", names: ["noah", "noah lee"] },
    { id: "UDAN1", names: ["daniel", "daniel kim"] },
    { id: "UDAN2", names: ["daniel", "daniel wu", "dan"] },
  ];

  test("exactly one match, any case", () => {
    expect(matchSlackUser("NOAH", dir)).toEqual({ status: "one", userId: "UNOAH" });
    expect(matchSlackUser("daniel wu", dir)).toEqual({
      status: "one",
      userId: "UDAN2",
    });
  });

  test("no match", () => {
    expect(matchSlackUser("Caroline", dir)).toEqual({ status: "none" });
    expect(matchSlackUser("  ", dir)).toEqual({ status: "none" });
  });

  test("several matches", () => {
    expect(matchSlackUser("Daniel", dir)).toEqual({ status: "many" });
  });
});

describe("getSlackDirectory", () => {
  test("pages through users.list and caches for 10 minutes", async () => {
    const pages = [
      {
        ok: true,
        members: [{ id: "U1", real_name: "Noah Lee" }, { id: "B1", is_bot: true }],
        response_metadata: { next_cursor: "c2" },
      },
      {
        ok: true,
        members: [{ id: "U2", real_name: "Caroline Chen" }],
        response_metadata: { next_cursor: "" },
      },
    ];
    const cursors: (string | null)[] = [];
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const args = new URLSearchParams(String(init?.body ?? ""));
      cursors.push(args.get("cursor"));
      return new Response(JSON.stringify(pages[cursors.length - 1]));
    }) as unknown as typeof fetch;

    const users = await getSlackDirectory("t", fetchImpl, 0);
    expect(users.map((u) => u.id)).toEqual(["U1", "U2"]);
    expect(cursors).toEqual([null, "c2"]);

    await getSlackDirectory("t", fetchImpl, DIRECTORY_TTL_MS - 1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test("a failed refresh serves the expired copy", async () => {
    const good = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: true, members: [{ id: "U1", real_name: "Noah" }] }),
        ),
    ) as unknown as typeof fetch;
    await getSlackDirectory("t", good, 0);
    const bad = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, error: "internal_error" })),
    ) as unknown as typeof fetch;
    const users = await getSlackDirectory("t", bad, DIRECTORY_TTL_MS + 1);
    expect(users.map((u) => u.id)).toEqual(["U1"]);
    expect(bad).toHaveBeenCalledTimes(1);
    // Another token's copy is never used.
    await expect(getSlackDirectory("other", bad, 0)).rejects.toMatchObject({
      code: "internal_error",
    });
  });

  test("a 429 with a short Retry-After is retried once", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () =>
      ++n === 1
        ? new Response("", { status: 429, headers: { "Retry-After": "2" } })
        : new Response(
            JSON.stringify({ ok: true, members: [{ id: "U1", real_name: "Noah" }] }),
          ),
    ) as unknown as typeof fetch;
    const sleep = vi.fn(async () => undefined);
    const users = await getSlackDirectory("t", fetchImpl, 0, sleep);
    expect(users.map((u) => u.id)).toEqual(["U1"]);
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test("a 429 with a long Retry-After, or twice, gives up", async () => {
    const limited = (after: string) =>
      vi.fn(
        async () =>
          new Response("", { status: 429, headers: { "Retry-After": after } }),
      ) as unknown as typeof fetch;
    const sleep = vi.fn(async () => undefined);
    const long = limited("30");
    await expect(getSlackDirectory("t", long, 0, sleep)).rejects.toMatchObject({
      code: "http_429",
    });
    expect(sleep).not.toHaveBeenCalled();
    const twice = limited("1");
    await expect(getSlackDirectory("t", twice, 0, sleep)).rejects.toMatchObject({
      code: "http_429",
    });
    expect(twice).toHaveBeenCalledTimes(2);
  });

  test("a Slack error throws", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, error: "missing_scope" })),
    ) as unknown as typeof fetch;
    await expect(getSlackDirectory("t", fetchImpl)).rejects.toMatchObject({
      code: "missing_scope",
    });
  });
});
