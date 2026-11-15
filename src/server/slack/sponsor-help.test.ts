import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const slackEnv = vi.hoisted(() => ({
  values: {} as Record<string, string | undefined>,
}));

vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("~/env")>();
  const env = original.env as Record<string | symbol, unknown>;
  return {
    env: new Proxy(env, {
      get(target, prop) {
        if (
          typeof prop === "string" &&
          (prop.startsWith("SPONSOR_HELP_SLACK_") || prop.startsWith("SLACK_"))
        ) {
          return slackEnv.values[prop];
        }
        return target[prop];
      },
    }),
  };
});

import {
  markSponsorHelpMessage,
  postSponsorHelpClaimed,
  postSponsorHelpRequest,
  repingSponsorHelp,
  slackDisplayName,
  sponsorHelpSigningSecret,
  sponsorHelpSlackEnabled,
} from "./sponsor-help";

const details = {
  sponsorName: "Scotiabank",
  reason: "swag" as const,
  note: "Blue shirts, size M",
  location: "Rm 2110",
};

const fetchMock = vi.fn();

function slackOk(extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: true, ...extra }), { status: 200 });
}

type Call = { url: string; body: Record<string, unknown>; init: RequestInit };
function calls(): Call[] {
  return fetchMock.mock.calls.map(([url, init]: [string, RequestInit]) => {
    const raw = String(init.body);
    const body = raw.startsWith("{")
      ? (JSON.parse(raw) as Record<string, unknown>)
      : Object.fromEntries(new URLSearchParams(raw));
    return { url, body, init };
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  slackEnv.values = {
    SPONSOR_HELP_SLACK_BOT_TOKEN: "xoxb-test",
    SPONSOR_HELP_SLACK_CHANNEL: "C123",
    SPONSOR_HELP_SLACK_MENTION: "<!subteam^S999>",
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postSponsorHelpRequest", () => {
  test("one post in the channel, mentioning the group", async () => {
    fetchMock.mockResolvedValueOnce(slackOk({ channel: "C123", ts: "111.222" }));
    const ref = await postSponsorHelpRequest(details);
    expect(ref).toEqual({ channel: "C123", ts: "111.222" });
    const all = calls();
    expect(all).toHaveLength(1);
    expect(all[0]!.url).toBe("https://slack.com/api/chat.postMessage");
    expect(all[0]!.body.channel).toBe("C123");
    expect(all[0]!.body.thread_ts).toBeUndefined();
    const text = String(all[0]!.body.text);
    expect(text).toContain("<!subteam^S999>");
    expect(text).toContain("*Scotiabank* needs help at Rm 2110: Out of swag");
    expect(text).toContain("> Blue shirts, size M");
    expect(
      (all[0]!.init.headers as Record<string, string>).Authorization,
    ).toBe("Bearer xoxb-test");
  });

  test("no post and no error when the token is missing", async () => {
    slackEnv.values.SPONSOR_HELP_SLACK_BOT_TOKEN = undefined;
    expect(sponsorHelpSlackEnabled()).toBe(false);
    await expect(postSponsorHelpRequest(details)).resolves.toBeNull();
    await expect(
      repingSponsorHelp({ channel: "C123", ts: "1.2" }, 1),
    ).resolves.toBe(false);
    await expect(
      markSponsorHelpMessage({ channel: "C123", ts: "1.2" }, details, {
        kind: "resolved",
      }),
    ).resolves.toBeUndefined();
    await expect(slackDisplayName("U1")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("Slack error or network failure returns null, never throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "channel_not_found" })),
    );
    await expect(postSponsorHelpRequest(details)).resolves.toBeNull();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(postSponsorHelpRequest(details)).resolves.toBeNull();
  });
});

describe("shared Slack app fallback", () => {
  test("uses SLACK_BOT_TOKEN when the help token is unset", async () => {
    slackEnv.values.SPONSOR_HELP_SLACK_BOT_TOKEN = undefined;
    slackEnv.values.SLACK_BOT_TOKEN = "xoxb-shared";
    expect(sponsorHelpSlackEnabled()).toBe(true);
    fetchMock.mockResolvedValueOnce(slackOk({ channel: "C123", ts: "1.2" }));
    await postSponsorHelpRequest(details);
    expect(
      (calls()[0]!.init.headers as Record<string, string>).Authorization,
    ).toBe("Bearer xoxb-shared");
  });

  test("the help token wins over the shared one", async () => {
    slackEnv.values.SLACK_BOT_TOKEN = "xoxb-shared";
    fetchMock.mockResolvedValueOnce(slackOk({ channel: "C123", ts: "1.2" }));
    await postSponsorHelpRequest(details);
    expect(
      (calls()[0]!.init.headers as Record<string, string>).Authorization,
    ).toBe("Bearer xoxb-test");
  });

  test("signing secret falls back to SLACK_SIGNING_SECRET", () => {
    expect(sponsorHelpSigningSecret()).toBeNull();
    slackEnv.values.SLACK_SIGNING_SECRET = "shared-secret";
    expect(sponsorHelpSigningSecret()).toBe("shared-secret");
    slackEnv.values.SPONSOR_HELP_SLACK_SIGNING_SECRET = "help-secret";
    expect(sponsorHelpSigningSecret()).toBe("help-secret");
  });

  test("neither token set: skipped silently", async () => {
    slackEnv.values.SPONSOR_HELP_SLACK_BOT_TOKEN = undefined;
    expect(sponsorHelpSlackEnabled()).toBe(false);
    await expect(postSponsorHelpRequest(details)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("repingSponsorHelp", () => {
  test("step 1 goes in the thread and re-mentions the group", async () => {
    fetchMock.mockResolvedValueOnce(slackOk({ ts: "333.444" }));
    await expect(
      repingSponsorHelp({ channel: "C123", ts: "111.222" }, 1),
    ).resolves.toBe(true);
    const [call] = calls();
    expect(call!.body.thread_ts).toBe("111.222");
    expect(call!.body.channel).toBe("C123");
    expect(String(call!.body.text)).toContain("<!subteam^S999>");
    expect(String(call!.body.text)).toContain("3 minutes");
  });

  test("step 2 uses @here", async () => {
    fetchMock.mockResolvedValueOnce(slackOk());
    await repingSponsorHelp({ channel: "C123", ts: "111.222" }, 2);
    const [call] = calls();
    expect(call!.body.thread_ts).toBe("111.222");
    expect(String(call!.body.text)).toMatch(/^<!here>.*6 minutes/);
  });
});

describe("message updates", () => {
  test("claimed edits the original post", async () => {
    fetchMock.mockResolvedValueOnce(slackOk());
    await markSponsorHelpMessage({ channel: "C123", ts: "111.222" }, details, {
      kind: "claimed",
      name: "Jazz",
    });
    const [call] = calls();
    expect(call!.url).toBe("https://slack.com/api/chat.update");
    expect(call!.body.ts).toBe("111.222");
    expect(String(call!.body.text)).toMatch(/^:white_check_mark: Claimed by Jazz/);
  });

  test("on-it reply goes in the thread", async () => {
    fetchMock.mockResolvedValueOnce(slackOk());
    await postSponsorHelpClaimed({ channel: "C123", ts: "111.222" }, "U42");
    const [call] = calls();
    expect(call!.body.thread_ts).toBe("111.222");
    expect(String(call!.body.text)).toContain("<@U42> is on it");
  });
});

describe("slackDisplayName", () => {
  test("prefers display name, falls back to real name", async () => {
    fetchMock.mockResolvedValueOnce(
      slackOk({ user: { name: "jazz", profile: { display_name: "Jazz G" } } }),
    );
    await expect(slackDisplayName("U1")).resolves.toBe("Jazz G");
    fetchMock.mockResolvedValueOnce(
      slackOk({
        user: { name: "jazz", real_name: "Jasmine", profile: { display_name: "" } },
      }),
    );
    await expect(slackDisplayName("U1")).resolves.toBe("Jasmine");
    expect(calls()[0]!.url).toBe("https://slack.com/api/users.info");
    expect(calls()[0]!.body.user).toBe("U1");
  });
});
