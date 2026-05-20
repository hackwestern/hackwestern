import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCollaborators, parseProjectTitle } from "~/server/api/lib/devpost";
import { parseGithubUrl, parseGithubUsername, HACK_START_UTC, LARGE_COMMIT_THRESHOLD } from "~/server/api/lib/github";

// ---------------------------------------------------------------------------
// github.ts helpers
// ---------------------------------------------------------------------------

describe("parseGithubUrl", () => {
  it("parses a standard https URL", () => {
    expect(parseGithubUrl("https://github.com/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("strips .git suffix", () => {
    expect(parseGithubUrl("https://github.com/owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("ignores trailing branch path", () => {
    expect(parseGithubUrl("https://github.com/owner/repo/tree/main")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("returns null for non-GitHub URLs", () => {
    expect(parseGithubUrl("https://gitlab.com/owner/repo")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseGithubUrl("not-a-url")).toBeNull();
  });
});

describe("parseGithubUsername", () => {
  it("extracts username from profile URL", () => {
    expect(parseGithubUsername("https://github.com/johndoe")).toBe("johndoe");
  });

  it("handles trailing slash", () => {
    expect(parseGithubUsername("https://github.com/johndoe/")).toBe("johndoe");
  });

  it("returns null for a repo URL (has path beyond username)", () => {
    // repo URLs have /owner/repo so they won't match the username-only pattern
    expect(parseGithubUsername("https://github.com/owner/repo")).toBeNull();
  });

  it("returns null for non-GitHub URLs", () => {
    expect(parseGithubUsername("https://gitlab.com/johndoe")).toBeNull();
  });
});

describe("HACK_START_UTC", () => {
  it("is set to Nov 22 2025 02:00 UTC (= Nov 21 9pm EST)", () => {
    expect(HACK_START_UTC.toISOString()).toBe("2025-11-22T02:00:00.000Z");
  });

  it("a commit from before the event is flagged as pre-event", () => {
    const preEvent = new Date("2025-11-21T01:00:00Z"); // before 02:00 UTC
    expect(preEvent < HACK_START_UTC).toBe(true);
  });

  it("a commit after event start passes", () => {
    const inEvent = new Date("2025-11-22T03:00:00Z");
    expect(inEvent >= HACK_START_UTC).toBe(true);
  });
});

describe("LARGE_COMMIT_THRESHOLD", () => {
  it("is 500 lines", () => {
    expect(LARGE_COMMIT_THRESHOLD).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// devpost.ts helpers
// ---------------------------------------------------------------------------

describe("parseCollaborators", () => {
  it("extracts names from a typical DevPost collaborators block", () => {
    const html = `
      <ul id="collaborators" class="large-2 columns">
        <li>
          <div class="software-team-member">
            <a href="/alice" class="user-profile-link">Alice Smith</a>
          </div>
        </li>
        <li>
          <div class="software-team-member">
            <a href="/bob" class="user-profile-link">Bob Jones</a>
          </div>
        </li>
      </ul>
    `;
    expect(parseCollaborators(html)).toEqual(["Alice Smith", "Bob Jones"]);
  });

  it("returns empty array when collaborators block is absent", () => {
    expect(parseCollaborators("<html><body>no list here</body></html>")).toEqual([]);
  });

  it("strips inner HTML tags from names", () => {
    const html = `
      <ul id="collaborators">
        <li><a href="/user"><img src="avatar.png"> Jane Doe</a></li>
      </ul>
    `;
    const result = parseCollaborators(html);
    expect(result[0]).toContain("Jane Doe");
  });

  it("handles an empty collaborators list", () => {
    const html = `<ul id="collaborators"></ul>`;
    expect(parseCollaborators(html)).toEqual([]);
  });

  it("does not return whitespace-only entries", () => {
    const html = `
      <ul id="collaborators">
        <li><a href="/user">   </a></li>
        <li><a href="/user2">Real Name</a></li>
      </ul>
    `;
    const result = parseCollaborators(html);
    expect(result).not.toContain("");
    expect(result).toContain("Real Name");
  });
});

describe("parseProjectTitle", () => {
  it("extracts the title from an app-title h1", () => {
    const html = `<h1 id="app-title" class="large-header">My Cool Project</h1>`;
    expect(parseProjectTitle(html)).toBe("My Cool Project");
  });

  it("trims surrounding whitespace", () => {
    const html = `<h1 id="app-title">  Trimmed Title  </h1>`;
    expect(parseProjectTitle(html)).toBe("Trimmed Title");
  });

  it("returns null when title element is missing", () => {
    expect(parseProjectTitle("<html><body>nothing</body></html>")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Commit violation logic (pure functions, no DB/network)
// ---------------------------------------------------------------------------

describe("commit violation detection logic", () => {
  const HACK_END_UTC = new Date("2025-11-23T14:00:00Z");

  function isViolation(dateStr: string) {
    const date = new Date(dateStr);
    return date < HACK_START_UTC || date > HACK_END_UTC;
  }

  it("flags a commit before event start", () => {
    expect(isViolation("2025-11-21T00:00:00Z")).toBe(true);
  });

  it("flags a commit after event end", () => {
    expect(isViolation("2025-11-24T00:00:00Z")).toBe(true);
  });

  it("passes a commit exactly at event start", () => {
    expect(isViolation("2025-11-22T02:00:00Z")).toBe(false);
  });

  it("passes a commit during the event", () => {
    expect(isViolation("2025-11-22T12:00:00Z")).toBe(false);
  });

  it("passes a commit exactly at event end", () => {
    expect(isViolation("2025-11-23T14:00:00Z")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unregistered contributor detection logic
// ---------------------------------------------------------------------------

describe("unregistered contributor detection", () => {
  function findUnregistered(
    contributors: { login: string }[],
    registeredLogins: string[],
  ) {
    const registered = new Set(registeredLogins.map((l) => l.toLowerCase()));
    return contributors.filter((c) => !registered.has(c.login.toLowerCase()));
  }

  it("returns empty when all contributors are registered", () => {
    const contributors = [{ login: "alice" }, { login: "bob" }];
    expect(findUnregistered(contributors, ["Alice", "Bob"])).toHaveLength(0);
  });

  it("flags a contributor not in the registered set", () => {
    const contributors = [{ login: "alice" }, { login: "outsider" }];
    const result = findUnregistered(contributors, ["alice"]);
    expect(result).toHaveLength(1);
    expect(result[0]?.login).toBe("outsider");
  });

  it("is case-insensitive", () => {
    const contributors = [{ login: "Alice" }];
    expect(findUnregistered(contributors, ["alice"])).toHaveLength(0);
  });

  it("flags all contributors when registered list is empty", () => {
    const contributors = [{ login: "alice" }, { login: "bob" }];
    expect(findUnregistered(contributors, [])).toHaveLength(2);
  });
});
