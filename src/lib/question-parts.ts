export type QuestionPart = {
  /** Printed sub-part label, e.g. "(a)", "(ii)". Empty when the question has no sub-parts. */
  label: string;
  text: string;
};

// Matches printed sub-part markers at the start of a segment: (a) a) (ii) (b)(i) etc.
const PART_MARKER =
  /(?:^|\n|\s)(\(?(?:[a-h]|i{1,3}|iv|vi{0,3}|ix|x)\)(?:\s*\((?:i{1,3}|iv|vi{0,3}|ix|x)\))?)(?=\s)/gi;

/**
 * Splits a dense multi-part exam question into labelled sub-question segments so
 * they can be rendered, answered and graded one block at a time.
 * Returns a single unlabelled part when the question has no printed sub-parts.
 */
export function splitQuestionParts(raw: string): QuestionPart[] {
  const text = (raw ?? "").replace(/\r/g, "").trim();
  if (!text) return [{ label: "", text: "" }];

  const marks: { index: number; label: string; end: number }[] = [];
  PART_MARKER.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PART_MARKER.exec(text)) !== null) {
    const label = match[1]!;
    const index = match.index + match[0].indexOf(label);
    marks.push({ index, label: label.startsWith("(") ? label : `(${label}`, end: index + label.length });
  }

  if (marks.length < 2) return [{ label: "", text }];

  const parts: QuestionPart[] = [];
  const stem = text.slice(0, marks[0]!.index).trim();
  if (stem) parts.push({ label: "", text: stem });

  marks.forEach((mark, i) => {
    const next = marks[i + 1]?.index ?? text.length;
    const body = text.slice(mark.end, next).trim();
    if (body) parts.push({ label: mark.label.replace(/^\(?/, "(").replace(/\)?$/, ")"), text: body });
  });

  return parts.length ? parts : [{ label: "", text }];
}

/** True when the question genuinely breaks into labelled sub-questions. */
export function hasSubParts(raw: string): boolean {
  return splitQuestionParts(raw).filter((p) => p.label).length > 1;
}
