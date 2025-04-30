import { useRef, useEffect } from "react";
import Head from "next/head";
import { Button } from "~/components/ui/button";

const imageSrcs = [
  "/images/wildlifewanderer.svg",
  "/images/citycruiser.svg",
  "/images/foodiefanatic.svg",
  "/images/beachbum.svg",
];

interface Sprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ImageSprite extends Sprite {
  img: HTMLImageElement;
  mask: Uint8ClampedArray; // RGBA packed pixel data
}

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useRef<number>(1);
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const spritesRef = useRef<ImageSprite[]>([]);
  const initialSpritesRef = useRef<ImageSprite[]>([]);

  const actionRef = useRef<"none" | "panning" | "dragSprite">("none");
  const dragTargetRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const drawRef = useRef<(() => void) | null>(() => null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    // preload images
    void (async () => {
      const loaded: ImageSprite[] = [];
      for (let i = 0; i < imageSrcs.length; i++) {
        const src = imageSrcs[i] ?? "";
        const img = new Image();
        img.src = src;
        await new Promise(res => (img.onload = res));
        const w = img.naturalWidth, h = img.naturalHeight;
        // draw into offscreen to extract mask
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const offCtx = off.getContext("2d")!;
        offCtx.drawImage(img, 0, 0, w, h);
        const data = offCtx.getImageData(0, 0, w, h).data;

        loaded.push({
          img,
          x: i * (w + 20) + 50,
          y: 100,
          w,
          h,
          mask: data,
        });
      }
      spritesRef.current = loaded;
      // deep clone initial positions & masks
      initialSpritesRef.current = loaded.map(s => ({ ...s, mask: s.mask.slice() }));
      drawRef.current?.();
    })();

    const toWorld = (e: PointerEvent) => ({
      x: (e.clientX - offsetRef.current.x) / scaleRef.current,
      y: (e.clientY - offsetRef.current.y) / scaleRef.current,
    });

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawRef.current?.();
    };

    const draw = () => {
      const { x: ox, y: oy } = offsetRef.current;
      const s = scaleRef.current;
      ctx.setTransform(s, 0, 0, s, ox, oy);

      // clear world-space
      const wx = -ox / s,
        wy = -oy / s,
        ww = canvas.width / s,
        wh = canvas.height / s;
      ctx.clearRect(wx, wy, ww, wh);

      // draw infinite dot-grid
      const spacing = 25,
        off = spacing / 2;
      ctx.fillStyle = "#888";
      const startXI = Math.floor((wx - off) / spacing),
        endXI = Math.ceil((wx + ww - off) / spacing);
      const startYI = Math.floor((wy - off) / spacing),
        endYI = Math.ceil((wy + wh - off) / spacing);
      for (let ix = startXI; ix <= endXI; ix++) {
        for (let iy = startYI; iy <= endYI; iy++) {
          const x = off + ix * spacing,
            y = off + iy * spacing;
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // draw sprites
      for (const spr of spritesRef.current) {
        ctx.drawImage(spr.img, spr.x, spr.y, spr.w, spr.h);
      }
    };

    drawRef.current = draw;
    window.addEventListener("resize", resize);
    resize();

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left,
        my = e.clientY - rect.top;
      const prev = scaleRef.current;
      const delta = 1 - e.deltaY * 0.002;
      const next = Math.min(Math.max(prev * delta, 0.5), 5);
      scaleRef.current = next;
      offsetRef.current.x = mx - ((mx - offsetRef.current.x) * next) / prev;
      offsetRef.current.y = my - ((my - offsetRef.current.y) * next) / prev;
      drawRef.current?.();
    };

    const onPointerDown = (e: PointerEvent) => {
      const world = toWorld(e);
      for (let i = spritesRef.current.length - 1; i >= 0; i--) {
        const spr = spritesRef.current[i];
        if (!spr) continue;
        const lx = Math.floor(world.x - spr.x);
        const ly = Math.floor(world.y - spr.y);
        if (
          lx >= 0 &&
          ly >= 0 &&
          lx < spr.w &&
          ly < spr.h &&
          spr.mask[(ly * spr.w + lx) * 4 + 3]! > 10 // alpha > threshold
        ) {
          actionRef.current = "dragSprite";
          dragTargetRef.current = i;
          dragOffsetRef.current = {
            x: world.x - spr.x,
            y: world.y - spr.y,
          };
          return;
        }
      }
      actionRef.current = "panning";
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (actionRef.current === "none") return;
      if (actionRef.current === "panning") {
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        offsetRef.current.x += dx;
        offsetRef.current.y += dy;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
      } else if (actionRef.current === "dragSprite") {
        const world = toWorld(e);
        const i = dragTargetRef.current;
        if (i !== null && spritesRef.current[i]) {
          spritesRef.current[i].x = world.x - dragOffsetRef.current.x;
          spritesRef.current[i].y = world.y - dragOffsetRef.current.y;
        }
      }
      drawRef.current?.();
    };

    const onPointerUp = () => {
      actionRef.current = "none";
      dragTargetRef.current = null;
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const handleReset = () => {
    const duration = 300; // ms
    const start = performance.now();

    // capture starting values
    const startScale = scaleRef.current;
    const startOffset = { ...offsetRef.current };
    const startSprites = spritesRef.current.map(s => ({ x: s.x, y: s.y }));

    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic

      // interpolate scale & offset
      scaleRef.current = startScale + (1 - startScale) * ease;
      offsetRef.current.x = startOffset.x * (1 - ease);
      offsetRef.current.y = startOffset.y * (1 - ease);

      // interpolate each sprite back to initialSpritesRef
      spritesRef.current = spritesRef.current.map((spr, i) => {
        const init = initialSpritesRef.current[i];
        return {
          ...spr,
          x: startSprites[i]!.x + (init!.x - startSprites[i]!.x) * ease,
          y: startSprites[i]!.y + (init!.y - startSprites[i]!.y) * ease,
        };
      });

      drawRef.current?.();

      if (t < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  return (
    <>
      <Head>
        <title>Canvas</title>
        <meta
          name="description"
          content="Hack Western: One of Canada's largest student-run hackathons."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="relative h-screen w-screen cursor-grab overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 touch-none" />
        {<Button onClick={handleReset} className="absolute bottom-4 right-4 z-10 bg-white text-md border hover:bg-slate-100 px-2.5 font-mono">
          reset
        </Button>}
      </div>
    </>
  );
}
