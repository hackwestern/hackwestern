import { api } from "~/utils/api";
import {
  BroadcastCanvas,
  BroadcastHeader,
  BroadcastWindow,
  easternTime,
  useNow,
} from "~/components/broadcast/shell";

// Live interview screen. The "Hack Western 13 Feed" window is see-through:
// in OBS, put the camera source under this Browser Source and line it up
// with the window. The name and role come from /internal/broadcast.

const POLL_MS = 15_000;

export default function BroadcastInterview() {
  const now = useNow();
  const { data } = api.broadcast.display.useQuery(undefined, {
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });

  return (
    <BroadcastCanvas title="Live Interview" transparent>
      <div className="absolute left-[40px] top-[40px] flex w-[1840px] flex-col items-start gap-[48px]">
        <div className="relative z-10">
          <BroadcastHeader
            dark
            pill={["Live interview", "Western University"]}
          />
        </div>
        {/* The huge shadow paints the navy background around the window and
            leaves the window itself transparent for the camera */}
        <BroadcastWindow
          title="Hack Western 13 Feed"
          className="h-[787px] w-full shadow-[0_0_0_2000px_#042239]"
        />
        <div className="relative z-10 flex w-full items-start justify-between whitespace-nowrap text-[48px]">
          <p className="flex items-center gap-[24px] font-semibold">
            <span className="text-white">{data?.interviewName ?? ""}</span>
            <span className="text-[#5aa1e8]">{data?.interviewRole ?? ""}</span>
          </p>
          <p className="font-bold tabular-nums text-[#5aa1e8]">
            {now !== null &&
              easternTime(new Date(now), {
                hour: "numeric",
                minute: "2-digit",
              })}
          </p>
        </div>
      </div>
    </BroadcastCanvas>
  );
}
