// Builds mocks/index.html: one page linking every mock, grouped by topic,
// newest version first. Rerun after adding a mock: node mocks/build-index.mjs
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

// Topic order and which folder names belong to each (first match wins).
const GROUPS = [
  ["Sponsor portal: whole flow, three feels", /^sponsor-portal-flow-/],
  ["Sponsor coffee chats: calendar", /^sponsor-chat-calendar/],
  ["Sponsor coffee chats: setup flow", /^sponsor-chat-setup/],
  ["Sponsor coffee chats: shortlist and earlier", /^(sponsor-coffee-chats|coffee-chat-reps|sponsor-interest|sponsor-hackers)/],
  ["Organizer: sponsors home table", /^(organizer-sponsors-home|sponsors-day-tab|organizer-redesign)/],
  ["Organizer: coffee chat board", /^(organizer-coffee|coffee-chat-board|coffee-chat-organizer|coffee-chat-live|room-|availability)/],
  ["Judging", /judging/],
  ["Schedule and run of show", /(schedule|run-of-show)/],
  ["Help, tasks and notifications", /(help|task-|notification|notify)/],
  ["Sponsor portal pages", /^sponsor-/],
  ["Hacker side", /^hacker-/],
  ["Wireframes and other", /./],
];

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function versionOf(name) {
  const m = name.match(/-v(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function firstLine(readme) {
  const lines = readme.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const text = lines.find((l) => !l.startsWith("#")) ?? lines[0] ?? "";
  return text.replace(/[*_`#>]/g, "").replace(/^-\s*/, "").slice(0, 180);
}

// First .png anywhere under a folder (skipping _to_delete), as a path relative to it.
function findPng(dir, rel = "") {
  const entries = readdirSync(join(dir, rel)).sort();
  for (const f of entries) if (f.endsWith(".png")) return rel ? `${rel}/${f}` : f;
  for (const f of entries) {
    if (f.startsWith("_")) continue;
    const sub = rel ? `${rel}/${f}` : f;
    if (statSync(join(dir, sub)).isDirectory()) {
      const hit = findPng(dir, sub);
      if (hit) return hit;
    }
  }
  return null;
}


// Where each mock's styling comes from (checked 2026-11-19 by matching its
// colours and components against sponsor-coffee-chats-v7 and the live app).
// All of them share the live app's colour palette and the Figtree font; the
// difference is which components and layout they copy. First match wins.
const STYLES = [
  [/^sponsor-portal-flow-hacker/, "Hacker /live site", "Copied from the hacker /live page code: top bar, sidebar, cards, checklist, Pix32 pixel font (src/components/live/)."],
  [/^sponsor-portal-flow-app|^organizer-sponsors-home/, "Current app", "Copied from the live app code it replaces (src/components/sponsors/), so it looks like what's built today."],
  [/^organizer-coffee-cards-grid/, "Refined + live cards", "v7 design system, with sponsor cards copied from the live organizer Coffee chats tab."],
  [/^(sponsor-portal-flow-refined|sponsor-chat-|sponsor-coffee-chats-v7|organizer-coffee-autofill-v[3-9])/, "Refined (v7 system)", "The design system from sponsor-coffee-chats-v7: type and spacing for hierarchy, few pills, blue = action, green = confirmed, amber = attention."],
  [/^(organizer-coffee-autofill-v[12]|sponsor-coffee-chats-v[3-6]|wireframes-)/, "Early draft", "Before the v7 system: live app colours and fonts, layout still being worked out."],
];
const styleOf = (name, kind) => {
  if (kind === "screenshots") return ["Screenshots of the app", "Screenshots of the real app (before and after a change), not a separate mock style."];
  const hit = STYLES.find(([re]) => re.test(name));
  return hit ? [hit[1], hit[2]] : ["Not labelled", ""];
};

const mocks = [];
for (const name of readdirSync(root)) {
  const dir = join(root, name);
  if (!statSync(dir).isDirectory() || name.startsWith("_")) continue;
  const files = readdirSync(dir);
  const htmls = files.filter((f) => f.endsWith(".html"));
  // Screenshot-only mocks have no page: link the folder and show its images.
  const entry = htmls.length === 0 ? "" : htmls.includes("index.html") ? "index.html" : htmls.sort()[0];
  let thumb = null;
  const shots = join(dir, "screens");
  if (existsSync(shots)) {
    const pngs = readdirSync(shots).filter((f) => f.endsWith(".png") && !f.startsWith("00-current")).sort();
    thumb = pngs.find((f) => /1280|1440|desktop/.test(f)) ?? pngs[0] ?? null;
  }
  if (!thumb) {
    const png = findPng(dir);
    if (png) thumb = png;
  }
  const readme = files.find((f) => f.toLowerCase() === "readme.md");
  const blurb = readme ? firstLine(readFileSync(join(dir, readme), "utf8")) : "";
  const modified = statSync(entry ? join(dir, entry) : dir).mtime;
  mocks.push({
    name,
    href: `${name}/${entry}`,
    kind: entry ? "page" : "screenshots",
    style: styleOf(name, entry ? "page" : "screenshots"),
    otherPages: htmls.filter((h) => h !== entry),
    thumb: thumb ? (thumb.includes("/") ? `${name}/${thumb}` : (existsSync(join(shots, thumb)) ? `${name}/screens/${thumb}` : `${name}/${thumb}`)) : null,
    blurb,
    modified,
    group: GROUPS.findIndex(([, re]) => re.test(name)),
    version: versionOf(name),
  });
}

const cardHtml = (m) => `
      <div class="card" data-name="${esc(m.name)}" data-style="${esc(m.style[0])}">
        <a class="link" href="${esc(m.href)}">
          <div class="thumb">${m.thumb ? `<img loading="lazy" src="${esc(m.thumb)}" alt="">` : `<span>No screenshot</span>`}</div>
          <div class="meta">
            <div class="name">${esc(m.name)}</div>
            <div class="style" title="${esc(m.style[1])}"><span class="chip">${esc(m.style[0])}</span> <span class="src">${esc(m.style[1])}</span></div>
            ${m.blurb ? `<div class="blurb">${esc(m.blurb)}</div>` : ""}
            <div class="date">${m.modified.toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${m.kind === "screenshots" ? " · Screenshots only" : ""}${m.otherPages.length ? ` · +${m.otherPages.length} page${m.otherPages.length > 1 ? "s" : ""}` : ""}</div>
          </div>
        </a>
        <button class="like" type="button" aria-pressed="false" aria-label="Like ${esc(m.name)}">♡</button>
      </div>`;

const buildSections = (list) => GROUPS.map(([title], i) => {
  const items = list
    .filter((m) => m.group === i)
    .sort((a, b) => b.modified - a.modified || b.version - a.version);
  if (items.length === 0) return "";
  return `<section><h2>${esc(title)} <span class="count">${items.length}</span></h2><div class="grid">${items.map(cardHtml).join("")}</div></section>`;
}).join("");

// One flat list, newest first by when the mock's page was last written.
const buildRecent = (list) => {
  const items = [...list].sort((a, b) => b.modified - a.modified);
  return `<section><h2>Most recently built <span class="count">${items.length}</span></h2><div class="grid">${items.map(cardHtml).join("")}</div></section>`;
};

const render = (list, pageTitle, intro, nav) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title>
<style>
  :root { --bg:#f7f7f5; --card:#fff; --ink:#1d1d1f; --muted:#6e6e73; --line:#e5e5e0; --accent:#2563eb; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111113; --card:#1c1c1f; --ink:#f2f2f2; --muted:#a1a1a6; --line:#2c2c30; --accent:#60a5fa; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  header { position:sticky; top:0; z-index:2; background:var(--bg); border-bottom:1px solid var(--line); padding:16px; }
  header h1 { margin:0 0 4px; font-size:20px; }
  header p { margin:0 0 10px; color:var(--muted); font-size:13px; }
  input { width:100%; max-width:420px; font:inherit; padding:10px 12px; border:1px solid var(--line); border-radius:10px; background:var(--card); color:var(--ink); }
  main { padding:8px 16px 48px; max-width:1400px; margin:0 auto; }
  h2 { font-size:15px; margin:28px 0 12px; }
  .count { color:var(--muted); font-weight:400; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:14px; }
  .card { position:relative; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  .card:hover, .card:focus-within { border-color:var(--accent); }
  .card.liked { border-color:#e11d48; box-shadow:0 0 0 1px #e11d48; }
  .link { display:flex; flex-direction:column; color:inherit; text-decoration:none; outline:none; }
  .like { position:absolute; top:8px; right:8px; width:44px; height:44px; border-radius:22px; border:1px solid var(--line); background:var(--card); color:var(--muted); font-size:22px; line-height:1; cursor:pointer; }
  .like[aria-pressed="true"] { color:#e11d48; border-color:#e11d48; }
  .like:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .tools { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .tools button { font:inherit; font-size:14px; padding:9px 12px; border-radius:10px; border:1px solid var(--line); background:var(--card); color:var(--ink); cursor:pointer; min-height:44px; }
  .tools button[aria-pressed="true"] { border-color:#e11d48; color:#e11d48; }
  #msg { color:var(--muted); font-size:13px; }
  .seg { display:inline-flex; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  .seg button { border:0; border-radius:0; min-height:44px; }
  .seg button[aria-pressed="true"] { background:var(--accent); color:#fff; }
  .style { margin-top:6px; font-size:12px; color:var(--muted); }
  .chip { display:inline-block; font-weight:600; color:var(--ink); background:var(--bg); border:1px solid var(--line); border-radius:999px; padding:1px 8px; margin-right:2px; }
  select { font:inherit; font-size:14px; padding:9px 10px; border-radius:10px; border:1px solid var(--line); background:var(--card); color:var(--ink); min-height:44px; }
  .thumb { aspect-ratio:16/10; background:var(--line); display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .thumb img { width:100%; height:100%; object-fit:cover; object-position:top left; }
  .thumb span { color:var(--muted); font-size:13px; }
  .meta { padding:10px 12px 12px; }
  .name { font-weight:600; font-size:14px; word-break:break-word; }
  .blurb { color:var(--muted); font-size:13px; margin-top:4px; }
  .date { color:var(--muted); font-size:12px; margin-top:6px; }
  .hidden { display:none !important; }
  header a { color:var(--accent); }
</style></head>
<body>
<header>
  <h1>${pageTitle}</h1>
  <p>${list.length} ${intro}, grouped by topic, newest first. ${nav} · <a href="CHANGES.md">Change log: every change asked for, and its status</a> Built ${new Date().toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.</p>
  <div class="tools">
    <input id="q" type="search" placeholder="Filter by name" aria-label="Filter mocks by name">
    <select id="styleFilter" aria-label="Filter by style"><option value="">All styles</option>${[...new Set(list.map((m) => m.style[0]))].map((st) => `<option>${esc(st)}</option>`).join("")}</select>
    <div class="seg" role="group" aria-label="Sort mocks">
      <button id="sortTopic" type="button" aria-pressed="true">Topic</button>
      <button id="sortRecent" type="button" aria-pressed="false">Most recent</button>
    </div>
    <button id="onlyLiked" type="button" aria-pressed="false">♥ Liked only (<span id="likedCount">0</span>)</button>
    <button id="copyLikes" type="button">Copy my likes</button>
    <span id="msg" role="status"></span>
  </div>
</header>
<main><div id="byTopic">${buildSections(list)}</div><div id="byRecent" hidden>${buildRecent(list)}</div></main>
<script>
  // Likes live in this browser only (localStorage), keyed by mock folder name,
  // so they survive rebuilding this page. "Copy my likes" gives a list to paste.
  const KEY = "hw-mock-likes";
  const load = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
  const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch {} };
  let likes = load();
  const q = document.getElementById("q");
  const onlyBtn = document.getElementById("onlyLiked");
  const msg = document.getElementById("msg");

  function paint() {
    document.querySelectorAll(".card").forEach((c) => {
      const on = likes.has(c.dataset.name);
      c.classList.toggle("liked", on);
      const b = c.querySelector(".like");
      b.setAttribute("aria-pressed", String(on));
      b.textContent = on ? "♥" : "♡";
    });
    document.getElementById("likedCount").textContent = likes.size;
    filter();
  }
  function filter() {
    const t = q.value.trim().toLowerCase();
    const only = onlyBtn.getAttribute("aria-pressed") === "true";
    const st = document.getElementById("styleFilter").value;
    document.querySelectorAll(".card").forEach((c) =>
      c.classList.toggle("hidden", (!!t && !c.dataset.name.includes(t)) || (only && !likes.has(c.dataset.name)) || (!!st && c.dataset.style !== st)));
    document.querySelectorAll("section").forEach((s) => s.classList.toggle("hidden", !s.querySelector(".card:not(.hidden)")));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".like");
    if (!b) return;
    const name = b.closest(".card").dataset.name;
    likes.has(name) ? likes.delete(name) : likes.add(name);
    save(likes); paint();
  });
  q.addEventListener("input", filter);
  document.getElementById("styleFilter").addEventListener("change", filter);
  onlyBtn.addEventListener("click", () => {
    onlyBtn.setAttribute("aria-pressed", String(onlyBtn.getAttribute("aria-pressed") !== "true"));
    filter();
  });
  document.getElementById("copyLikes").addEventListener("click", async () => {
    const text = likes.size ? "Liked mocks:\\n" + [...likes].sort().map((n) => "- " + n).join("\\n") : "No liked mocks yet.";
    try { await navigator.clipboard.writeText(text); msg.textContent = "Copied. Paste it to Claude."; }
    catch { window.prompt("Copy your likes:", text); }
    setTimeout(() => (msg.textContent = ""), 3000);
  });
  // Sort view: Topic (grouped) or Most recent (flat, newest first). Remembered per browser.
  const SORT_KEY = "hw-mock-sort";
  const topicBtn = document.getElementById("sortTopic");
  const recentBtn = document.getElementById("sortRecent");
  function setSort(mode) {
    const recent = mode === "recent";
    document.getElementById("byTopic").hidden = recent;
    document.getElementById("byRecent").hidden = !recent;
    topicBtn.setAttribute("aria-pressed", String(!recent));
    recentBtn.setAttribute("aria-pressed", String(recent));
    try { localStorage.setItem(SORT_KEY, mode); } catch {}
  }
  topicBtn.addEventListener("click", () => setSort("topic"));
  recentBtn.addEventListener("click", () => setSort("recent"));
  let savedSort = "topic";
  try { savedSort = localStorage.getItem(SORT_KEY) || "topic"; } catch {}
  setSort(savedSort);
  paint();
</script>
</body></html>`;

const pages = mocks.filter((m) => m.kind === "page");
const shotsOnly = mocks.filter((m) => m.kind === "screenshots");
writeFileSync(join(root, "index.html"), render(pages, "Sponsor dashboard mocks", "HTML mocks", `<a href="screenshots.html">Screenshot-only mocks (${shotsOnly.length}) →</a>`));
writeFileSync(join(root, "screenshots.html"), render(shotsOnly, "Screenshot-only mocks", "screenshot folders", `<a href="index.html">← HTML mocks (${pages.length})</a>`));
console.log(`Wrote mocks/index.html (${pages.length} HTML mocks) and mocks/screenshots.html (${shotsOnly.length}).`);
