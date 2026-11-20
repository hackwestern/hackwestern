import { chromium } from "playwright";
const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844}});
p.on("console",m=>console.log("c:",m.text()));p.on("pageerror",e=>console.log("err",e.message));
await p.goto("file:///C:/Users/Jasmine%20Gu/hackwestern-sponsor-dash/mocks/sponsor-judging-redesign-a-v1/index.html#r2");await p.waitForTimeout(500);
for(let i=0;i<5;i++)await p.locator("[data-pick]").nth(i).click();
await p.evaluate(()=>{["pointerdown","pointermove","pointerup"].forEach(t=>document.addEventListener(t,e=>console.log(t,e.target.tagName,e.clientY, JSON.stringify(drag&&{i:drag.i,to:drag.to})),true))});
const h=await p.locator('[data-handle="0"]').boundingBox();console.log(JSON.stringify(h));
await p.mouse.move(h.x+22,h.y+22);await p.mouse.down();for(let i=1;i<=3;i++)await p.mouse.move(h.x+22,h.y+22+i*50);await p.mouse.up();
console.log(await p.locator(".slot.filled .tx b").allTextContents());await b.close();
