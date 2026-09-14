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

// Natural exam-numbering hierarchy, shallowest first: 9 -> (a) -> (i). Used to decide
// whether an incoming marker closes the currently open level(s) when indentation alone
// doesn't say so (see the pop logic in splitQuestionParts).
const MARKER_RANK: Record<MarkerKind, number> = { number: 0, letter: 1, roman: 2 };

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
    if (value.length === 1 && LETTER.test(value) && token === value && !openKinds.includes("letter")) {
      return "letter";
    }
    return "roman";
  }
  if (LETTER.test(value)) {
    // Only LOWERCASE single letters are structural sub-part markers, e.g. "(a)" "(b)".
    // Uppercase A/B/C/D are reserved for printed multiple-choice options (see
    // OPTION_MARKER / isMultipleChoice above) and must never be read as a marker here
    // — otherwise a block of MCQ options gets mistaken for independent sub-questions
    // and split into fake nested (a)(b)(c)(d) parts.
    if (token !== value) return null;
    return "letter";
  }
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
    // Compound head: "9a", "9(a)", "9 (a) (i)" at the very start of the line. An optional
    // leading "*" (Pearson/Edexcel's marker for an extended, quality-of-written-
    // communication sub-question, e.g. "*(b)" or "*9") doesn't change what the marker is.
    const head = /^[ \t]*\*?((?:\d{1,2}|[a-z]{1,4})[ \t]*[).\]]?)((?:[ \t]*\((?:\d{1,2}|[a-z]{1,4})\))*)/i.exec(
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
            // All tokens in one compound cluster ("9(a)(i)", or "1." and "(a)" run
            // together as "1. (a) ...") share the line's real physical indent. Their
            // relative nesting is decided by MARKER_RANK (number -> letter -> roman) in
            // the pop logic below, not by a synthetic per-token indent bump: bumping
            // indent here used to make a compound-clustered "(a)" register as more
            // indented than a later, genuinely-standalone "(i)" printed on its own
            // unindented line — even though they're meant to nest normally — which
            // caused the pop logic to treat the standalone marker as "shallower" and
            // close (a) prematurely instead of nesting under it.
            indent,
          });
          if (!openKinds.includes(kind)) openKinds.push(kind);
          accepted += 1;
        }
      }
      if (accepted) consumed = head[0].length;
    }

    // Inline markers further along the same line: "... (b) Explain why ...". Also allow
    // an optional leading "*" right before the paren, same as the head marker above — a
    // sub-part like "*(ii)" printed with no space between the asterisk and "(" would
    // otherwise sit right next to neither a line-start nor a whitespace character and be
    // invisible to this regex entirely, silently merging that whole sub-part's content
    // into the previous one's.
    const inline = /(?:^|\s)\*?\(\s*(\d{1,2}|[a-z]{1,4})\s*\)(?=\s)/gi;
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

  // Note: we deliberately do NOT gate on isMultipleChoice(text) here. That check scans
  // the whole raw string for an A/B/C/D option run and used to short-circuit the entire
  // question — including any real (a)/(i)/(ii) structure around the MCQ block — into a
  // single flat node. A question can legitimately contain an MCQ nested several levels
  // deep (e.g. 3 -> (a) -> (i) is the MCQ, (ii) is open-ended) alongside real structure,
  // so "is there an MCQ somewhere" must never short-circuit "does this question have
  // sub-parts". Genuine parts are found below via findMarkers; a question that truly has
  // no printed sub-parts (MCQ-only or otherwise) already falls out through the
  // `markers.length < 2` branch immediately after, with the same single-block result.
  const markers = findMarkers(text);
  // Answer sheets print numbered blank lines for "name two things" style questions
  // ("1 .......... 2 .........."), and findMarkers can't tell a bare "1"/"2" like that
  // apart from a genuine question number just from the token alone. Each question's own
  // text should only ever contain ONE real top-level number (the question itself, e.g.
  // "7." or "1."), so a LATER "number"-kind marker at the outermost (unindented) level is
  // never a second real question start. It's one of two things instead:
  //  - a genuinely blank answer line (nothing but dots/underscores follows it) — this
  //    contributes nothing, so it's dropped entirely, rather than fracturing the rest of
  //    the question into a bogus new top-level sibling (e.g. "1.(a)(i)" then "2.(b)"
  //    instead of "1.(a)(i)" then "1.(b)").
  //  - a genuine numbered sub-heading with real text after it, used to structure a
  //    multi-part answer ("1 Effect of temperature" / "2 Effect of source of starch") —
  //    this is kept, but forced to nest under whatever part is currently open rather than
  //    closing back out to a new top-level root, since it's clearly still part of that
  //    same open sub-question, not a second main question.
  // A number marker that's genuinely indented deeper is unaffected either way — it still
  // nests normally (e.g. calculation steps printed under a lettered part).
  let sawTopLevelNumber = false;
  const meaningfulMarkers: (Marker & { forceChild?: boolean })[] = [];
  markers.forEach((marker, i) => {
    if (marker.kind !== "number" || marker.indent > 0) {
      meaningfulMarkers.push(marker);
      return;
    }
    if (!sawTopLevelNumber) {
      sawTopLevelNumber = true;
      meaningfulMarkers.push(marker);
      return;
    }
    const next = markers[i + 1]?.index ?? text.length;
    const rawBody = text.slice(marker.end, next).replace(/\(\d{1,2}\)/g, "");
    const hasRealText = rawBody.replace(/[\s._\-–—·…]/g, "").length >= 3;
    if (hasRealText) meaningfulMarkers.push({ ...marker, forceChild: true });
  });
  if (meaningfulMarkers.length < 2) {
    return [{ label: "", path: "", depth: 0, text: text.trim(), children: [] }];
  }

  const roots: QuestionPart[] = [];
  const stem = text.slice(0, meaningfulMarkers[0]!.index).trim();
  if (stem) roots.push({ label: "", path: "", depth: 0, text: stem, children: [] });

  // Stack of currently open levels; each entry remembers its marker style and indent.
  const stack: { kind: MarkerKind; indent: number; node: QuestionPart }[] = [];

  meaningfulMarkers.forEach((marker, i) => {
    const next = meaningfulMarkers[i + 1]?.index ?? text.length;
    const body = text
      .slice(marker.end, next)
      .replace(/^[\s).:\]-]+/, "")
      // Strip a trailing "*" left over when the NEXT marker was itself printed as "*(ii)"
      // etc. — the asterisk sits just before that marker's "(" and so falls at the very
      // end of THIS body slice, not inside the next marker's own text.
      .replace(/\*\s*$/, "")
      .trim();

    // A forceChild marker (a numbered sub-heading following an already-used top-level
    // number, see above) always nests under whatever is currently open — skip the normal
    // pop logic entirely, since popping could otherwise send it straight back to root.
    // Crucially, it's never pushed onto `stack`: leaving the stack untouched means a run of
    // several consecutive forceChild markers all read the same (currently open) parent off
    // the top of the stack and land as siblings of each other, and the next REAL marker
    // afterwards still pops correctly relative to whatever was genuinely open before the
    // forceChild run started — not relative to a forceChild node it was never meant to nest
    // under.
    if (marker.forceChild) {
      const parent = stack[stack.length - 1];
      const siblings = parent ? parent.node.children : roots;
      const node: QuestionPart = {
        label: marker.label,
        path: `${parent?.node.path ?? ""}${marker.label}`,
        depth: stack.length,
        text: body,
        children: [],
      };
      siblings.push(node);
      return;
    }

    // Pop to the level this marker belongs to. Indentation is the primary signal, exactly
    // as printed: less-indented always closes the open (deeper) level, more-indented is
    // always a genuine child (e.g. a "1." "2." calculation-steps list nested under a
    // lettered part stays nested, even though "number" is usually the outermost kind).
    // Indentation only fails to say anything when it TIES — most often because
    // scraped/OCR'd exam text is flattened with zero indentation throughout. In that case
    // fall back to the natural exam-numbering hierarchy (number -> letter -> roman): a
    // marker whose kind is the same as, or naturally shallower than, the open level closes
    // it. Without this fallback, "(b)" following "(a)(iii)" at equal (zero) indentation
    // would get swallowed as a child of "(iii)" instead of becoming a sibling of "(a)".
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      if (marker.indent < top.indent) {
        stack.pop();
      } else if (marker.indent === top.indent) {
        const sameKind = top.kind === marker.kind;
        const shallowerKind = MARKER_RANK[marker.kind] <= MARKER_RANK[top.kind];
        if (sameKind || shallowerKind) stack.pop();
        else break;
      } else break;
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
    };



    if (parent) parent.node.children.push(node);
    else roots.push(node);
    stack.push({ kind: marker.kind, indent: marker.indent, node });
  });

  return roots.length ? roots : [{ label: "", path: "", depth: 0, text: text.trim(), children: [] }];
}

/**
 * A printed per-part mark allocation, e.g. "(3)", "[3 marks]", "(2 marks)" — exam boards
 * commonly print this right at the end of each lettered/numbered sub-part's own text.
 * Matched only at the very end of a part's text (after trimming), since splitQuestionParts
 * already slices each part's text to stop right where the next marker begins, so a
 * genuinely-printed allocation for that part always lands at that boundary.
 */
const TRAILING_MARKS =
  /(?:[([]\s*(?:total\s*[:\-]?\s*)?(\d{1,3})\s*(?:marks?)?\s*[)\]]|(\d{1,3})\s*marks?)\.?\s*$/i;

/** Reads a printed mark allocation off the end of one part's own text, if present.
 * Returns null when nothing is printed there (common when a board only totals marks
 * for the whole question rather than breaking them down per sub-part). */
function extractTrailingMarks(text: string): number | null {
  const match = TRAILING_MARKS.exec(text.trim());
  if (!match) return null;
  const raw = match[1] ?? match[2];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value <= 100 ? value : null;
}

/**
 * The actionable questions a student actually answers: the deepest labelled parts.
 * A parent whose text is only scene-setting is not an answer box — its children are.
 */
export function leafParts(
  parts: QuestionPart[],
): { label: string; text: string; context: string; marks: number | null }[] {
  const leaves: { label: string; text: string; context: string; marks: number | null }[] = [];

  const walk = (node: QuestionPart, context: string) => {
    if (!node.label) return;
    if (node.children.length) {
      const nextContext = [context, node.text].filter(Boolean).join(" ").trim();
      node.children.forEach((child) => walk(child, nextContext));
      return;
    }
    leaves.push({ label: node.path || node.label, text: node.text, context, marks: extractTrailingMarks(node.text) });
  };

  parts.forEach((part) => walk(part, ""));
  return leaves;
}

/** True when the question genuinely breaks into labelled sub-questions. */
export function hasSubParts(raw: string): boolean {
  return leafParts(splitQuestionParts(raw)).length > 1;
}
