import { SPONSOR_BAY_BOOTHS } from "~/lib/sponsor-bay-layout";

const NBSP = "\u00A0";

/** Company names the portal shows: every Sponsor Bay booth, plus us. */
const KNOWN_NAMES = [
  ...SPONSOR_BAY_BOOTHS.map((b) => b.sponsor),
  "Hack Western",
];

/**
 * Every company name stays on one line (Jazz, portal v6): the spaces inside
 * known names (and any `extra` names, like the viewer's own company) become
 * non-breaking, so "Canada Life Workshop" can wrap only after "Life".
 * The mock does the same after each render (wrapCo).
 */
export function keepNamesTogether(
  text: string,
  extra: readonly (string | null | undefined)[] = [],
): string {
  const names = [...KNOWN_NAMES, ...extra].filter(
    (n): n is string => !!n && n.includes(" "),
  );
  let out = text;
  for (const name of names) {
    if (out.includes(name))
      out = out.split(name).join(name.replace(/ /g, NBSP));
  }
  return out;
}
