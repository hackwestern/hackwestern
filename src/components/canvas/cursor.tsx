import { useEffect, useRef } from "react";
import throttle from "lodash";

export default function CursorFollower() {
  const followerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = throttle((e: MouseEvent) => {
      if (followerRef.current) {
        followerRef.current.style.left = `${e.clientX}px`;
        followerRef.current.style.top = `${e.clientY}px`;
      }
    }, 100) as (e: MouseEvent) => void;

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      ref={followerRef}
      className="pointer-events-none fixed z-50 bg-[#667799] p-1"
      style={{
        transform: "translate(1.25rem, 1.25rem)",
        boxShadow: "0 2px 5px rgba(0, 0, 0, 0.3)",
        borderRadius: "0.15rem",
      }}
    >
      <div className="flex h-full w-full items-center justify-center">
        <p className="font-figtree text-xs text-white">10x hacker</p>
      </div>
    </div>
  );
}
