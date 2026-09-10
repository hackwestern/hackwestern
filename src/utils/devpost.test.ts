import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DevpostScrapeError,
  fetchDevpostTechStack,
  normalizeDevpostUrl,
  parseBuiltWith,
} from "~/utils/devpost";

function builtWithHtml(
  tags: { label: string; recognized?: boolean }[],
): string {
  const items = tags
    .map(({ label, recognized = true }) =>
      recognized
        ? `<li><span class="cp-tag recognized-tag"><a href="https://devpost.com/software/built-with/${label}">${label}</a></span></li>`
        : `<li><span class="cp-tag">${label}</span></li>`,
    )
    .join("");

  return `<html><body>
    <div id="built-with" class="">
      <h2>Built With</h2>
      <ul class="no-bullet inline-list">${items}</ul>
    </div>
  </body></html>`;
}

describe("normalizeDevpostUrl", () => {
  it("strips the _gl analytics blob off a copied project link", () => {
    expect(
      normalizeDevpostUrl(
        "https://devpost.com/software/hackwestern?_gl=1*znq4gl*_gcl_au*NjM1ODE1MDUwLjE3ODgzNTU1MzA.*_ga*MTY4NTU4NDA3NQ..",
      ),
    ).toBe("https://devpost.com/software/hackwestern");
  });

  it("leaves an already-clean URL alone", () => {
    expect(
      normalizeDevpostUrl("https://devpost.com/software/hackwestern"),
    ).toBe("https://devpost.com/software/hackwestern");
  });

  it("drops trailing sub-paths and fragments", () => {
    expect(
      normalizeDevpostUrl("https://devpost.com/software/hackwestern/edit#top"),
    ).toBe("https://devpost.com/software/hackwestern");
  });

  it("accepts a bare host with no protocol", () => {
    expect(normalizeDevpostUrl("devpost.com/software/hackwestern")).toBe(
      "https://devpost.com/software/hackwestern",
    );
  });

  it("accepts a hackathon subdomain and canonicalizes it", () => {
    expect(
      normalizeDevpostUrl(
        "https://hackwestern.devpost.com/software/hackwestern",
      ),
    ).toBe("https://devpost.com/software/hackwestern");
  });

  it("rejects a non-DevPost host", () => {
    expect(() =>
      normalizeDevpostUrl("https://github.com/software/hackwestern"),
    ).toThrow(DevpostScrapeError);
  });

  it("rejects a DevPost URL that is not a project page", () => {
    expect(() => normalizeDevpostUrl("https://devpost.com/akuwuh")).toThrow(
      DevpostScrapeError,
    );
    expect(() => normalizeDevpostUrl("https://devpost.com/software/")).toThrow(
      DevpostScrapeError,
    );
  });

  it("rejects empty and unparseable input", () => {
    expect(() => normalizeDevpostUrl("   ")).toThrow(DevpostScrapeError);
    expect(() => normalizeDevpostUrl("http://")).toThrow(DevpostScrapeError);
  });
});

describe("parseBuiltWith", () => {
  it("reads both linked and bare tags, in page order", () => {
    const html = builtWithHtml([
      { label: "css3" },
      { label: "fastapi", recognized: false },
      { label: "python" },
      { label: "next.js", recognized: false },
    ]);

    expect(parseBuiltWith(html)).toEqual([
      "css3",
      "fastapi",
      "python",
      "next.js",
    ]);
  });

  it("returns [] when the project lists no technologies", () => {
    expect(parseBuiltWith(builtWithHtml([]))).toEqual([]);
  });

  it("returns [] when the page has no Built With section at all", () => {
    expect(
      parseBuiltWith("<html><body><h1>hackwestern</h1></body></html>"),
    ).toEqual([]);
  });

  it("ignores cp-tag spans outside the Built With section", () => {
    const html = `<html><body>
      <div id="submissions"><span class="cp-tag">not-a-tech</span></div>
      ${builtWithHtml([{ label: "redis" }])}
    </body></html>`;

    expect(parseBuiltWith(html)).toEqual(["redis"]);
  });

  it("decodes entities and collapses whitespace in labels", () => {
    const html = builtWithHtml([
      { label: "c&#35;", recognized: false },
      { label: "amazon\n  web   services", recognized: false },
      { label: "at&amp;t", recognized: false },
    ]);

    expect(parseBuiltWith(html)).toEqual(["c#", "amazon web services", "at&t"]);
  });

  it("leaves out-of-range numeric entities as literal text", () => {
    const html = builtWithHtml([
      { label: "bad&#999999999;tag", recognized: false },
      { label: "hex&#x110000;tag", recognized: false },
      { label: "python" },
    ]);

    expect(() => parseBuiltWith(html)).not.toThrow();
    expect(parseBuiltWith(html)).toEqual([
      "bad&#999999999;tag",
      "hex&#x110000;tag",
      "python",
    ]);
  });

  it("still decodes entities at the edges of the valid range", () => {
    const html = builtWithHtml([
      { label: "&#65;", recognized: false },
      { label: "&#x10FFFF;", recognized: false },
    ]);

    expect(parseBuiltWith(html)).toEqual(["A", String.fromCodePoint(0x10ffff)]);
  });

  it("deduplicates case-insensitively, keeping the first spelling", () => {
    const html = builtWithHtml([
      { label: "React" },
      { label: "react", recognized: false },
    ]);

    expect(parseBuiltWith(html)).toEqual(["React"]);
  });
});

describe("fetchDevpostTechStack", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the normalized URL and returns its tags", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          builtWithHtml([{ label: "python" }, { label: "redis" }]),
        ),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchDevpostTechStack(
        "https://devpost.com/software/hackwestern?_gl=1*znq4gl",
      ),
    ).resolves.toEqual(["python", "redis"]);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://devpost.com/software/hackwestern",
    );
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: () => "" }),
    );

    await expect(
      fetchDevpostTechStack("https://devpost.com/software/gone"),
    ).rejects.toThrow(DevpostScrapeError);
  });

  it("wraps a network failure rather than leaking it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );

    await expect(
      fetchDevpostTechStack("https://devpost.com/software/hackwestern"),
    ).rejects.toThrow(DevpostScrapeError);
  });

  it("rejects a bad URL without hitting the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchDevpostTechStack("https://example.com/software/hackwestern"),
    ).rejects.toThrow(DevpostScrapeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds the request with an abort signal it supplies itself", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: "https://devpost.com/software/hackwestern",
      text: () => Promise.resolve(builtWithHtml([{ label: "python" }])),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchDevpostTechStack("https://devpost.com/software/hackwestern");

    const signal = (
      fetchMock.mock.calls[0]?.[1] as { signal?: AbortSignal } | undefined
    )?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
  });

  it("names a timeout for what it is", async () => {
    const timeout = new Error("The operation was aborted");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));

    await expect(
      fetchDevpostTechStack("https://devpost.com/software/slow"),
    ).rejects.toThrow(/timed out after \d+ms/);
  });

  it("bounds the body read too, not just the response headers", async () => {
    const timeout = new Error("terminated");
    timeout.name = "TimeoutError";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: "https://devpost.com/software/slow",
        // Headers arrive, then the stream stalls out.
        text: () => Promise.reject(timeout),
      }),
    );

    await expect(
      fetchDevpostTechStack("https://devpost.com/software/slow"),
    ).rejects.toThrow(/timed out after \d+ms/);
  });

  it("throws when DevPost bounces the project to a login page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: "https://devpost.com/users/login",
        text: () => Promise.resolve("<html><body>Log in</body></html>"),
      }),
    );

    await expect(
      fetchDevpostTechStack("https://devpost.com/software/hackwestern"),
    ).rejects.toThrow(/private, unpublished, or deleted/);
  });

  it("throws when DevPost redirects anywhere else off the project", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: "https://devpost.com/",
        text: () => Promise.resolve("<html></html>"),
      }),
    );

    await expect(
      fetchDevpostTechStack("https://devpost.com/software/hackwestern"),
    ).rejects.toThrow(DevpostScrapeError);
  });

  it("still reads a project that redirected to a renamed slug", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: "https://devpost.com/software/hackwestern-renamed",
        text: () => Promise.resolve(builtWithHtml([{ label: "python" }])),
      }),
    );

    await expect(
      fetchDevpostTechStack("https://devpost.com/software/hackwestern"),
    ).resolves.toEqual(["python"]);
  });

  it("treats a genuinely empty Built With section as empty, not a failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: "https://devpost.com/software/bare",
        text: () => Promise.resolve(builtWithHtml([])),
      }),
    );

    await expect(
      fetchDevpostTechStack("https://devpost.com/software/bare"),
    ).resolves.toEqual([]);
  });
});
