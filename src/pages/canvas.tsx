import { useRef, useEffect } from "react";
import Head from "next/head";

const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      draw();
    };

    const draw = () => {
      const { x: ox, y: oy } = offsetRef.current;
      const s = scaleRef.current;

      // apply transform
      ctx.setTransform(s, 0, 0, s, ox, oy);
      // clear the visible area in world coords
      const worldXMin = -ox / s;
      const worldYMin = -oy / s;
      const worldXMax = (canvas.width - ox) / s;
      const worldYMax = (canvas.height - oy) / s;
      ctx.clearRect(worldXMin, worldYMin, worldXMax - worldXMin, worldYMax - worldYMin);

      // draw infinite dot-grid
      const spacing = 25;
      const dotOffset = spacing / 2;
      ctx.fillStyle = "#888";

      const startXI = Math.floor((worldXMin - dotOffset) / spacing);
      const endXI   = Math.ceil((worldXMax - dotOffset) / spacing);
      const startYI = Math.floor((worldYMin - dotOffset) / spacing);
      const endYI   = Math.ceil((worldYMax - dotOffset) / spacing);

      for (let ix = startXI; ix <= endXI; ix++) {
        const x = dotOffset + ix * spacing;
        for (let iy = startYI; iy <= endYI; iy++) {
          const y = dotOffset + iy * spacing;
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // fixed-world object at (100,100)
      ctx.fillStyle = "red";
      ctx.fillRect(100 - 5, 100 - 5, 10, 10);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const prev = scaleRef.current;
      const delta = 1 - e.deltaY * 0.002;
      const next = Math.min(Math.max(prev * delta, 0.2), 5);
      scaleRef.current = next;
      offsetRef.current.x = mx - ((mx - offsetRef.current.x) * next) / prev;
      offsetRef.current.y = my - ((my - offsetRef.current.y) * next) / prev;
      draw();
    };

    const onMouseDown = (e: MouseEvent) => {
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      offsetRef.current.x += dx;
      offsetRef.current.y += dy;
      lastPos.current = { x: e.clientX, y: e.clientY };
      draw();
    };
    const onMouseUp = () => {
      isPanning.current = false;
    };

    window.addEventListener("resize", resize);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    resize();
    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Canvas</title>
        <meta
          name="description"
          content="Hack Western: One of Canada's largest annual student-run hackathons based out of Western University in London, Ontario."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="relative h-screen w-screen">
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </>
  );
};

export default Canvas;
