export type QuestionPart = {
  /** Printed sub-part label, e.g. "(a)", "(ii)". Empty when the question has no sub-parts. */
  label: string;
  text: string;
};

// Matches printed sub-part markers at the start of a segment: (a) a) (ii) (b)(i) etc.
const PART_MARKER =
  /(?:^|\n|\s)(\(?(?:[a-h]|i{1,3}|iv|vi{0,3}|ix|x)\)(?:\s*\((?:i{1,3}|iv|vi{0,3}|ix|x)\))?)(?=\s)/gi;

// Printed multiple-choice option markers: "A.", "B)", "(C)", "□ D", "○ A".
const OPTION_MARKER = /(?:^|\n|\s)[(\[]?\s*([A-Da-d])\s*[).\]:]\s+/g;

const MCQ_PHRASE =
  /(which (one )?of the following|tick (one|the) box|select (one|the correct)|choose (one|the correct)|circle the (correct|letter)|shade (one|the) (box|bubble)|answer [a-d],? ?[a-d]|multiple[\s-]?choice)/i;

const BUBBLE = /[\u25A1\u25CB\u25EF\u2610\u2B1C\u229B\u25FB]/; // □ ○ ◯ ☐ etc.

/**
 * True when the block is a multiple-choice question: its lettered markers are the
 * answer options, not independent open-ended sub-tasks. These must stay as one card.
 */
export function isMultipleChoice(raw: string): boolean {
  const text = (raw ?? "").replace(/\r/g, "");
  if (!text.trim()) return false;

  if (MCQ_PHRASE.test(text)) return true;
  if (BUBBLE.test(text)) return true;

  OPTION_MARKER.lastIndex = 0;
  const letters: string[] = [];
  const bodies: number[] = [];
  let match: RegExpExecArray | null;
  let lastEnd = 0;
  while ((match = OPTION_MARKER.exec(text)) !== null) {
    letters.push(match[1]!.toUpperCase());
    if (lastEnd) bodies.push(match.index - lastEnd);
    lastEnd = match.index + match[0].length;
  }
  if (letters.length < 3) return false;
  bodies.push(text.length - lastEnd);

  // Options run A, B, C, (D) in order and each choice is a short phrase, not a task.
  const expected = ["A", "B", "C", "D"];
  const ordered = letters.slice(0, 4).every((letter, i) => letter === expected[i]);
  const shortChoices = bodies.filter((length) => length > 0 && length <= 120).length >= 3;
  return ordered && shortChoices;
}

/**
 * Splits a dense multi-part exam question into labelled sub-question segments so
 * they can be rendered, answered and graded one block at a time.
 * Multiple-choice questions and questions without printed sub-parts stay as one block.
 */
export function splitQuestionParts(raw: string): QuestionPart[] {
  const text = (raw ?? "").replace(/\r/g, "").trim();
  if (!text) return [{ label: "", text: "" }];
  // Never break an MCQ apart: its A/B/C/D markers are answer options.
  if (isMultipleChoice(text)) return [{ label: "", text }];

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
