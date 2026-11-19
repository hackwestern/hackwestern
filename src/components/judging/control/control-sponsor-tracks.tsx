import { CARD_TITLE, SPONSOR_TRACKS } from "./control-shared";

/** Placeholder until sponsor-round marks get their own ranking. */
export function ControlSponsorTracks() {
  return (
    <section
      aria-labelledby="sponsor-tracks-title"
      className="flex min-w-0 flex-col gap-2.5 rounded-2xl border-[1.5px] border-dashed border-[#b4570b] bg-white p-4 sm:p-5"
    >
      <h2 id="sponsor-tracks-title" className={CARD_TITLE}>
        Sponsor track rankings
      </h2>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {SPONSOR_TRACKS.map((track) => (
          <li
            key={track}
            className="rounded-full bg-[#eef1f6] px-2.5 py-1 text-xs font-semibold text-[#2e4a66]"
          >
            {track}
          </li>
        ))}
      </ul>
      <p className="m-0 text-sm leading-[1.45] text-[#6b3a10]">
        Sponsor judges&apos; marks are saved, but there&apos;s no ranking for
        them yet.
      </p>
    </section>
  );
}
