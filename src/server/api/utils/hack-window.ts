import { TRPCError } from "@trpc/server";
import { env } from "~/env";

/**
 * The event's hacking window from `HACK_START`/`HACK_END`, required by the
 * cheat check and Wrapped to check commit activity against the start/end times.
 */
export function requireHackWindow() {
  if (!env.HACK_START || !env.HACK_END) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "HACK_START and HACK_END environment variables must be set before running cheat checks or Wrapped",
    });
  }
  return {
    hackStart: new Date(env.HACK_START),
    hackEnd: new Date(env.HACK_END),
  };
}
