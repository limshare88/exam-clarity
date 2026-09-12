export type QuestionPart = {
  /** Printed sub-part label, e.g. "(a)", "(ii)", "1". Empty for the question stem. */
  label: string;
  /** Full hierarchical label, e.g. "(a)(i)". Empty for the stem. */
  path: string;
  /** Visual nesting depth, 0 for the stem and top-level parts. */
  depth: number;
  text: string;
  children: QuestionPart[];
};

type MarkerKind = "number" | "letter" | "roman";

type Marker = {
  /** Index in the source text where the marker starts. */
  index: number;
  /** Index where the marker ends (body begins). */
  end: number;
  label: string;
  kind: MarkerKind;
  indent: number;
};

// Printed multiple-choice option markers: "A.", "B)", "(C)", "□ D", "○ A".
// Uppercase letters only: exam boards print MCQ options as A/B/C/D, while
// lowercase (a) (b) (c) labels are open-ended sub-questions.
const OPTION_MARKER = /(?:^|\n|\s)[(\[]?\s*([A-D])\s*[).\]:]\s+/g;

const MCQ_PHRASE =
  /(which (one )?of the following|tick (one|the) box|select (one|the correct)|choose (one|the correct)|circle the (correct|letter)|shade (one|the) (box|bubble)|answer [a-d],? ?[a-d]|multiple[\s-]?choice)/i;

const BUBBLE = /[\u25A1\u25CB\u25EF\u2610\u2B1C\u229B\u25FB]/; // □ ○ ◯ ☐ etc.

const ROMAN = /^(?:i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,2})$/;
const LETTER = /^[a-h]$/;

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

  const expected = ["A", "B", "C", "D"];
  const ordered = letters.slice(0, 4).every((letter, i) => letter === expected[i]);
  const shortChoices = bodies.filter((length) => length > 0 && length <= 120).length >= 3;
  return ordered && shortChoices;
}

function classify(token: string, openKinds: MarkerKind[]): MarkerKind | null {
  const value = token.toLowerCase();
  if (/^\d{1,2}$/.test(value)) return "number";
  if (ROMAN.test(value)) {
    // "i" and "v" are both letters and numerals: read them as numerals only when a
    // lettered level is already open above them (9 -> (a) -> (i)).
    if (value.length === 1 && LETTER.test(value) && !openKinds.includes("letter")) return "letter";
    return "roman";
  }
  if (LETTER.test(value)) return "letter";
  return null;
}

function pretty(token: string, kind: MarkerKind): string {
  return kind === "number" ? `${token}.` : `(${token.toLowerCase()})`;
}

/**
 * Finds every printed sub-question marker, in any common exam board style:
 * "1." "2)" "(a)" "b)" "(i)" "ii)" and compound forms like "1a" or "9(b)(ii)".
 */
function findMarkers(text: string): Marker[] {
  const markers: Marker[] = [];
  const lines = text.split("\n");
  let offset = 0;
  const openKinds: MarkerKind[] = [];

  for (const line of lines) {
    const indent = line.length - line.trimStart().length;
    // Compound head: "9a", "9(a)", "9 (a) (i)" at the very start of the line.
    const head = /^[ \t]*((?:\d{1,2}|[a-z]{1,4})[ \t]*[).\]]?)((?:[ \t]*\((?:\d{1,2}|[a-z]{1,4})\))*)/i.exec(
      line,
    );

    let consumed = 0;
    if (head) {
      const tokens: { raw: string; at: number; len: number }[] = [];
      const first = /(\d{1,2}|[a-z]{1,4})/i.exec(head[1]!)!;
      tokens.push({
        raw: first[1]!,
        at: head.index + head[0].indexOf(head[1]!),
        len: head[1]!.length,
      });
      const tailRe = /\((\d{1,2}|[a-z]{1,4})\)/gi;
      let tail: RegExpExecArray | null;
      const tailStart = head[0].length - (head[2]?.length ?? 0);
      while (head[2] && (tail = tailRe.exec(head[2])) !== null) {
        tokens.push({ raw: tail[1]!, at: tailStart + tail.index, len: tail[0].length });
      }

      // Unbracketed compound style glued to the number: "1a", "9c(ii)".
      if (!head[2]) {
        const glued = /^([a-z]{1,3})[).\]]?(?=\s)/.exec(line.slice(head[0].length));
        if (glued && /^\d{1,2}$/.test(tokens[0]!.raw)) {
          tokens.push({
            raw: glued[1]!,
            at: head[0].length + glued[0].indexOf(glued[1]!),
            len: glued[0].length,
          });
        }
      }


      const rest = line.slice(head[0].length).trim();
      const valid = rest.length > 0 || tokens.length > 0;

      let accepted = 0;
      if (valid) {
        for (const token of tokens) {
          const kind = classify(token.raw, openKinds);
          if (!kind) break;
          markers.push({
            index: offset + token.at,
            end: offset + token.at + token.len,
            label: pretty(token.raw, kind),
            kind,
            indent: indent + accepted,
          });
          if (!openKinds.includes(kind)) openKinds.push(kind);
          accepted += 1;
        }
      }
      if (accepted) consumed = head[0].length;
    }

    // Inline markers further along the same line: "... (b) Explain why ..."
    const inline = /(?:^|\s)\(\s*(\d{1,2}|[a-z]{1,4})\s*\)(?=\s)/gi;
    inline.lastIndex = consumed;
    let hit: RegExpExecArray | null;
    while ((hit = inline.exec(line)) !== null) {
      const kind = classify(hit[1]!, openKinds);
      if (!kind) continue;
      const at = hit.index + hit[0].indexOf("(");
      markers.push({
        index: offset + at,
        end: offset + hit.index + hit[0].length,
        label: pretty(hit[1]!, kind),
        kind,
        indent,
      });
      if (!openKinds.includes(kind)) openKinds.push(kind);
    }

    offset += line.length + 1;
  }

  return markers.sort((a, b) => a.index - b.index);
}

/**
 * Splits a multi-part exam question into a nested hierarchy of sub-questions.
 * Depth comes from the line's visual indentation first, and falls back to the
 * order in which marker styles appear, so any board's labelling nests correctly.
 * Multiple-choice questions and questions without printed sub-parts stay whole.
 */
export function splitQuestionParts(raw: string): QuestionPart[] {
  const text = (raw ?? "").replace(/\r/g, "").replace(/\s+$/, "");
  if (!text.trim()) return [{ label: "", path: "", depth: 0, text: "", children: [] }];
  if (isMultipleChoice(text)) return [{ label: "", path: "", depth: 0, text: text.trim(), children: [] }];

  const markers = findMarkers(text);
  if (markers.length < 2) {
    return [{ label: "", path: "", depth: 0, text: text.trim(), children: [] }];
  }

  const roots: QuestionPart[] = [];
  const stem = text.slice(0, markers[0]!.index).trim();
  if (stem) roots.push({ label: "", path: "", depth: 0, text: stem, children: [] });

  // Stack of currently open levels; each entry remembers its marker style and indent.
  const stack: { kind: MarkerKind; indent: number; node: QuestionPart }[] = [];

  markers.forEach((marker, i) => {
    const next = markers[i + 1]?.index ?? text.length;
    const body = text.slice(marker.end, next).replace(/^[\s).:\]-]+/, "").trim();

    // Pop to the level this marker belongs to: same style, or shallower indentation.
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      if (top.kind === marker.kind || marker.indent < top.indent) stack.pop();
      else break;
    }

    const parent = stack[stack.length - 1];

    // "1a" then "1b": the repeated main number is the same parent, not a new one.
    const siblings = parent ? parent.node.children : roots;
    const twin = siblings[siblings.length - 1];
    if (!parent && twin && twin.label === marker.label && twin.label) {
      stack.push({ kind: marker.kind, indent: marker.indent, node: twin });
      if (body && !twin.text) twin.text = body;
      return;
    }

    const node: QuestionPart = {
      label: marker.label,
      path: `${parent?.node.path ?? ""}${marker.label}`,
      depth: stack.length,
      text: body,
      children: [],


    if (parent) parent.node.children.push(node);
    else roots.push(node);
    stack.push({ kind: marker.kind, indent: marker.indent, node });
  });

  return roots.length ? roots : [{ label: "", path: "", depth: 0, text: text.trim(), children: [] }];
}

/**
 * The actionable questions a student actually answers: the deepest labelled parts.
 * A parent whose text is only scene-setting is not an answer box — its children are.
 */
export function leafParts(parts: QuestionPart[]): { label: string; text: string; context: string }[] {
  const leaves: { label: string; text: string; context: string }[] = [];

  const walk = (node: QuestionPart, context: string) => {
    if (!node.label) return;
    if (node.children.length) {
      const nextContext = [context, node.text].filter(Boolean).join(" ").trim();
      node.children.forEach((child) => walk(child, nextContext));
      return;
    }
    leaves.push({ label: node.path || node.label, text: node.text, context });
  };

  parts.forEach((part) => walk(part, ""));
  return leaves;
}

/** True when the question genuinely breaks into labelled sub-questions. */
export function hasSubParts(raw: string): boolean {
  return leafParts(splitQuestionParts(raw)).length > 1;
}
