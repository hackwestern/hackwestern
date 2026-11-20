import { cn } from "~/lib/utils";
import { pressable } from "./sponsor-shell-styles";

// The sponsor portal's small building blocks from mock sponsor-chats-v3
// (its .btn, .card, .note, .chip and .seg2), as class strings so links and
// buttons share them. Every tap target is at least 44px.

const ring =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2";

const base = cn(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-dashboard-lg border border-transparent px-4 text-base font-medium no-underline",
  "disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45 [&_svg]:size-5 [&_svg]:shrink-0",
  ring,
  pressable,
);

export const btn = {
  primary: cn(
    base,
    "bg-dashboard-action-primary text-dashboard-text-inverse shadow-dashboard-primary-btn [@media(hover:hover)]:hover:bg-dashboard-text-active",
  ),
  /** The shortlist step's purple primary button. */
  group: cn(
    base,
    "bg-dashboard-group-text text-dashboard-text-inverse shadow-dashboard-primary-btn [@media(hover:hover)]:hover:bg-dashboard-group-strong",
  ),
  danger: cn(
    base,
    "bg-dashboard-notice-danger text-dashboard-text-inverse shadow-dashboard-primary-btn",
  ),
  outline: cn(
    base,
    "border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-heavy [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
  ),
  link: cn(
    base,
    "min-w-11 px-2 text-sm font-semibold text-dashboard-text-link [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
  ),
  /** Bigger: a stage card's one main button. */
  lg: "min-h-[52px] px-6 text-[17px] font-bold",
  /** Smaller text, same 44px target (timeline buttons). */
  sm: "px-3 text-sm font-semibold",
};

/** A white card (the mock's .card). */
export const card =
  "flex min-w-0 flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-5 shadow-dashboard-card md:p-6";

/** A card's small title row with an icon (the mock's .card-t). */
export function CardTitle({
  icon,
  id,
  children,
  className,
}: {
  icon: React.ReactNode;
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={cn(
        "m-0 flex items-center gap-2.5 text-base font-semibold [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-dashboard-action-primary",
        className,
      )}
    >
      {icon}
      {children}
    </h2>
  );
}

/** A tinted note with an icon (the mock's .note). */
export function Note({
  icon,
  tone = "plain",
  id,
  children,
  className,
}: {
  icon: React.ReactNode;
  tone?: "plain" | "warn" | "ok" | "strong";
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "flex items-start gap-2.5 rounded-dashboard-lg px-3.5 py-3 text-sm [&>svg]:mt-px [&>svg]:size-[18px] [&>svg]:shrink-0",
        tone === "plain" && "bg-dashboard-bg-inset text-dashboard-text-medium [&>svg]:text-dashboard-text-light",
        tone === "warn" && "bg-dashboard-notice-cautionBg text-dashboard-text-warning",
        tone === "ok" && "bg-dashboard-notice-okBg text-dashboard-notice-okText",
        tone === "strong" &&
          "border-l-4 border-dashboard-border-task bg-dashboard-notice-cautionBg text-[15px] text-dashboard-text-heavy [&>svg]:text-dashboard-text-warning",
        className,
      )}
    >
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A filter chip (the mock's .chip); pressed = filled blue. */
export const chip = (pressed: boolean) =>
  cn(
    "inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-dashboard-lg px-3 text-sm font-medium",
    ring,
    pressable,
    pressed
      ? "bg-dashboard-action-primary text-dashboard-text-inverse"
      : "bg-dashboard-bg-nav text-dashboard-text-heavy [@media(hover:hover)]:hover:bg-dashboard-bg-navSelected",
  );

/** A segmented switch (the mock's .seg2): the frame, then each button. */
export const seg = {
  frame: "grid auto-cols-fr grid-flow-col gap-1 rounded-dashboard-lg bg-dashboard-bg-nav p-1",
  button: (pressed: boolean) =>
    cn(
      "min-h-11 min-w-0 rounded-dashboard-md px-1.5 text-[15px] font-semibold",
      ring,
      pressable,
      pressed
        ? "bg-dashboard-bg-surface text-dashboard-text-heavy shadow-dashboard-card"
        : "text-dashboard-text-medium",
    ),
};
