import { describe, expect, test } from "vitest";
import { memoryStore } from "./bot-state";
import {
  FINAL_AT,
  FINAL_SENT_KEY,
  decide,
  runPings,
  type CronDeps,
} from "./pings-cron";

const ON = { ORGANIZER_NOTIFICATIONS_ENABLED: "1", AUTO_PING_ENABLED: "1" };

describe("decide", () => {
  test("off unless PINGS_CRON says otherwise", () => {
    expect(decide({ ...ON })).toMatchObject({ run: false, failed: false });
    expect(decide({ ...ON, PINGS_CRON: "off" })).toMatchObject({ run: false });
  });

  test("dry-run runs without needing the bots switched on", () => {
    expect(decide({ PINGS_CRON: "dry-run" })).toEqual({
      run: true,
      dryRun: true,
    });
  });

  test("live needs both on-switches, so a missing one can't cancel the queue", () => {
    expect(decide({ ...ON, PINGS_CRON: "live" })).toEqual({
      run: true,
      dryRun: false,
    });
    const refused = decide({
      PINGS_CRON: "live",
      ORGANIZER_NOTIFICATIONS_ENABLED: "1",
      AUTO_PING_ENABLED: "0",
    });
    expect(refused).toMatchObject({ run: false, failed: true });
    expect(!refused.run && refused.reason).toContain("AUTO_PING_ENABLED");
    expect(decide({ PINGS_CRON: "live" })).toMatchObject({ run: false });
  });

  test("an unknown mode is refused, not treated as live", () => {
    expect(decide({ ...ON, PINGS_CRON: "yes" })).toMatchObject({
      run: false,
      failed: true,
    });
  });
});

function deps(overrides: Partial<CronDeps> = {}) {
  const calls: string[] = [];
  const base: CronDeps = {
    env: {},
    store: memoryStore(),
    now: () => FINAL_AT - 60_000,
    organizer: async (dry) => {
      calls.push(`organizer:${dry}`);
      return "org ok";
    },
    autoPingSync: async (dry) => {
      calls.push(`sync:${dry}`);
      return "ap ok";
    },
    autoPingFinal: async (dry) => {
      calls.push(`final:${dry}`);
      return "final ok";
    },
    ...overrides,
  };
  return { deps: base, calls };
}

describe("runPings", () => {
  test("runs both bots, passing the dry-run flag", async () => {
    const { deps: d, calls } = deps();
    const result = await runPings(d, true);
    expect(calls).toEqual(["organizer:true", "sync:true"]);
    expect(result).toMatchObject({ mode: "dry-run", failed: false });
    expect(result.final).toBeUndefined();
  });

  test("one bot failing still runs the other, and marks the run failed", async () => {
    const { deps: d, calls } = deps({
      organizer: async () => {
        throw new Error("sheet unreachable");
      },
    });
    const result = await runPings(d, false);
    expect(calls).toEqual(["sync:false"]);
    expect(result.organizer).toBe("error: sheet unreachable");
    expect(result.failed).toBe(true);
  });

  test("the final thank you goes once, from Sunday 6 PM", async () => {
    const store = memoryStore();
    const { deps: d, calls } = deps({ store, now: () => FINAL_AT });
    await runPings(d, false);
    await runPings(d, false);
    expect(calls.filter((c) => c.startsWith("final"))).toEqual(["final:false"]);
    expect(await store.get(FINAL_SENT_KEY)).not.toBeNull();
  });

  test("a final that refuses (blank counts) is retried next minute, without failing the run", async () => {
    const store = memoryStore();
    let tries = 0;
    const { deps: d } = deps({
      store,
      now: () => FINAL_AT,
      autoPingFinal: async () => {
        tries++;
        throw new Error("{hackers} is blank");
      },
    });
    const result = await runPings(d, false);
    await runPings(d, false);
    expect(tries).toBe(2);
    expect(result.failed).toBe(false);
    expect(await store.get(FINAL_SENT_KEY)).toBeNull();
  });

  test("a dry run never marks the final as sent", async () => {
    const store = memoryStore();
    const { deps: d } = deps({ store, now: () => FINAL_AT });
    await runPings(d, true);
    expect(await store.get(FINAL_SENT_KEY)).toBeNull();
  });
});
