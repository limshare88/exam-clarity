/** Paper labels are shown as a clean "Paper 1" ... "Paper 7" everywhere (Upload picker,
 * Practice filter). Text read from a paper's own cover page (e.g. "Pure Mathematics P1")
 * is never shown as-is; it is only used when it clearly names a paper number. */

/** Returns "Paper N" when the text clearly names a paper number 1-7, otherwise null. */
export function cleanPaperLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/\b(?:paper|p)\s*0?([1-7])\b/i);
  return m ? `Paper ${m[1]}` : null;
}

/** Same as cleanPaperLabel, but keeps a typed custom value (e.g. "Unit 3") instead of dropping it. */
export function normalizePaperLabel(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  return cleanPaperLabel(raw) ?? raw.trim();
}
