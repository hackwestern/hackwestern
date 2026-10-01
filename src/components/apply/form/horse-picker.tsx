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
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative aspect-[823/500] w-full">
        {horses.map((horse) => {
          const isSelected = horse.id === selectedId;
          return (
            <button
              key={horse.id}
              type="button"
              onClick={() => onSelect(horse)}
              aria-label={`Choose horse ${horse.id} from the ${horse.realm} realm`}
              className={cn(
                "absolute cursor-pointer transition-transform duration-150 ease-out",
                isSelected
                  ? "scale-110 drop-shadow-[0_6px_12px_rgba(4,34,57,0.35)]"
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
