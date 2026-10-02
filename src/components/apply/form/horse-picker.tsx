/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { cn } from "~/lib/utils";
import { horses, type Horse } from "~/constants/realms";

export interface HorsePickerProps {
  selectedId?: number | null;
  onSelect: (horse: Horse) => void;
  className?: string;
}

export function HorsePicker({
  selectedId,
  onSelect,
  className,
}: HorsePickerProps) {
  const hasSelection = selectedId != null;
  return (
    <div className={cn("flex w-full flex-col items-center gap-3", className)}>
      <div
        className={cn(
          "relative aspect-[823/500] w-full",
          // Keep the picker contained within whatever space the Window gives
          // it after the heading + footer. 40vh / 320px cap is small enough
          // to fit on a 720p laptop even after sidebar + traffic-light chrome.
          "max-h-[min(40vh,320px)]",
          "max-w-[min(calc(40vh*1.646),calc(320px*1.646))]",
        )}
      >
        {horses.map((horse) => {
          const isSelected = horse.id === selectedId;
          return (
            <button
              key={horse.id}
              type="button"
              onClick={() => onSelect(horse)}
              aria-label={`Choose horse ${horse.id} from the ${horse.realm} realm`}
              aria-pressed={isSelected}
              className={cn(
                "absolute cursor-pointer transition-all duration-300 ease-out",
                // Pull the hovered / selected horse to the top of the stack
                // so overlapping rectangular hitboxes don't steal clicks
                // from the horse the user is actually aiming at.
                "z-0 hover:z-20 focus-visible:z-20",
                isSelected
                  ? "z-10 scale-110 opacity-100 drop-shadow-[0_6px_12px_rgba(4,34,57,0.45)]"
                  : hasSelection
                    ? "scale-95 opacity-50 hover:scale-100 hover:opacity-80"
                    : "hover:scale-[1.06] hover:drop-shadow-[0_4px_10px_rgba(4,34,57,0.25)]",
              )}
              style={{
                left: `${horse.leftPct}%`,
                top: `${horse.topPct}%`,
                width: `${horse.widthPct}%`,
              }}
            >
              <img
                src={horse.asset}
                alt=""
                className="pointer-events-none h-auto w-full select-none"
                draggable={false}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
