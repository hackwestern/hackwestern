import React, { CSSProperties } from "react";

interface CloudDriftProps {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  startX?: string;
  endX?: string;
  wait?: number;
  top?: string;
  className?: string;
}

export default function CloudDrift({
  children,
  duration = 30,
  delay = 0,
  startX = "-40vw",
  endX = "100vw",
  className = "",
  wait = 0,
}: CloudDriftProps) {
  const totalTime = duration + wait;

  const movePercent = (duration / totalTime) * 100;
  return (
    <div
      className={className}
      style={
        {
          position: "absolute",
          left: 0,
          pointerEvents: "none",

          animation: `cloud-drift ${duration}s linear ${delay}s infinite`,
          animationFillMode: "backwards", 

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

          var(--cloud-move-percent) {
            transform: translateX(var(--cloud-end));
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