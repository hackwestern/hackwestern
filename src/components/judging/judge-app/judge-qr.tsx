/**
 * Reads the text inside a team QR code and returns its table number, or null
 * when the text isn't one of ours.
 *
 * PLACEHOLDER FORMAT until the team QR codes exist: "hw13:table:52".
 * A bare number ("52") also works, which makes a hand-made test code easy.
 * When the real format is decided, change only this function.
 */
export function parseTableCode(text: string): number | null {
  const match = /^(?:hw13:table:)?(\d{1,3})$/i.exec(text.trim());
  if (!match) return null;
  const table = Number(match[1]);
  return table > 0 ? table : null;
}