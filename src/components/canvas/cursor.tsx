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
      className="bg-[#667799] p-1 fixed pointer-events-none z-50"
      style={{
        transform: "translate(1.25rem, 1.25rem)",
        boxShadow: "0 2px 5px rgba(0, 0, 0, 0.3)",
        borderRadius: "0.15rem",
      }}
    >
      <div className="flex justify-center items-center w-full h-full">
        <p className="text-xs text-white font-figtree">
          10x hacker
        </p>
      </div>
    </div>
  );
}
