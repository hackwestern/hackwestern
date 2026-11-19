import { chromium } from "playwright";
import { encode } from "next-auth/jwt";
const token = await encode({ token: { sub: "redesign-organizer-1", name: "R", email: "redesign.organizer@test.local" }, secret: "local-dev-only-secret" });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies([{ name: "next-auth.session-token", value: token, url: "http://localhost:3020" }]);
const p = await ctx.newPage();
p.on("console", (m) => m.type() === "error" && console.log("console:", m.text().slice(0, 200)));
await p.goto("http://localhost:3020/internal/sponsors?tab=sponsors", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);
console.log(await p.evaluate(() => {
  const els = [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().height > 1500);
  return els.map(e => `${e.tagName}.${(e.className+"").slice(0,80)} h=${e.getBoundingClientRect().height}`).join("\n");
}));
await b.close();
