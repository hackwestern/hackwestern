import type { CSSProperties, ReactNode } from "react";

interface CloudDriftProps {
  children: ReactNode;

  // How long one complete trip across the screen takes.
  duration?: number;

  // Delay before starting.
  delay?: number;

  // Starting position.
  startX?: string;

  // Ending position.
  endX?: string;

  className?: string;
}

export default function CloudDrift({
  children,
  duration = 30,
  delay = 0,
  startX = "-30vw",
  endX = "130vw",
  className = "",
}: CloudDriftProps) {
  return (
    <div
      className={className}
      style={
        {
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",

          animation: `cloud-drift ${duration}s linear ${delay}s infinite`,

          "--cloud-start": startX,

          "--cloud-end": endX,
        } as CSSProperties & Record<`--${string}`, string>
      }
    >
      {children}

      <style jsx>{`
        @keyframes cloud-drift {
          0% {
            transform: translateX(var(--cloud-start));
          }

          100% {
            transform: translateX(var(--cloud-end));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          div {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}