import katex from "katex";

/** Exam questions frequently come back from extraction with inline LaTeX math wrapped in
 * single dollar signs (e.g. "$l_1$", "$y = mx + c$") -- the model's own natural way of
 * representing formulas in text, not something the extraction prompt explicitly asks for.
 * Splits text into alternating plain-text and math segments so each can be rendered
 * appropriately, instead of showing the raw "$...$" markup or (worse) letting a math
 * segment get torn apart word-by-word by whitespace-based tokenizers like VocabText's
 * tap-to-define splitting. */
const MATH_SPLIT = /(\$[^$\n]+\$)/g;

export type TextSegment = { type: "math" | "text"; content: string };

/** A plain-text numeric fraction like "3/4" or "15/16". Not part of a date ("12/05/2022"),
 * a unit ("km/h") or a longer number, so neighbouring digits, letters, dots and slashes
 * on either side rule it out. */
const PLAIN_FRACTION = /(?<![\w./])(\d{1,3})\/(\d{1,3})(?![\w./])/g;

/** The same numeric "a/b" inside a LaTeX segment, but not part of an exponent, subscript
 * or command argument (e.g. "x^1/2" or "\frac{1}{2}/3" stay as written). */
const LATEX_SLASH_FRACTION = /(?<![\w.^_{}\\/])(\d{1,3})\/(\d{1,3})(?![\w./{])/g;

/** Shows fractions stacked (numerator over denominator) at full size: plain "3/4" becomes
 * \dfrac{3}{4}, and \frac becomes \dfrac, since inline \frac is drawn small and cramped,
 * which is hard to read. */
function stackFractions(latex: string): string {
  return latex
    .replace(/\\frac(?![a-z])/g, "\\dfrac")
    .replace(LATEX_SLASH_FRACTION, (_m, n: string, d: string) => `\\dfrac{${n}}{${d}}`);
}

function splitPlainFractions(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  PLAIN_FRACTION.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PLAIN_FRACTION.exec(text)) !== null) {
    if (match.index > last) out.push({ type: "text", content: text.slice(last, match.index) });
    out.push({ type: "math", content: `\\dfrac{${match[1]}}{${match[2]}}` });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", content: text.slice(last) });
  return out;
}

export function splitMathSegments(text: string): TextSegment[] {
  return text
    .split(MATH_SPLIT)
    .filter((part) => part.length > 0)
    .flatMap((part) => {
      const match = /^\$([^$\n]+)\$$/.exec(part);
      return match?.[1] ? [{ type: "math" as const, content: stackFractions(match[1]) }] : splitPlainFractions(part);
    });
}

/** Renders one LaTeX expression via KaTeX. Falls back to the raw source (still better
 * than a blank space) if KaTeX itself can't parse it -- a malformed or partial LaTeX
 * fragment shouldn't take down the whole question's rendering. */
export function MathSpan({ latex }: { latex: string }) {
  let html: string;
  try {
    html = katex.renderToString(latex, { throwOnError: false, displayMode: false, output: "html" });
  } catch {
    html = latex;
  }
  // eslint-disable-next-line react/no-danger -- KaTeX's own sanitized output, not user HTML
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Plain (non-tappable) math-aware text renderer, for spots that show question text
 * without VocabText's tap-a-word-for-its-definition behaviour (e.g. the blueprint box's
 * restated prompt above the answer field). */
export function MathText({ text, className }: { text: string; className?: string }) {
  const segments = splitMathSegments(text);
  return (
    <p className={className}>
      {segments.map((segment, i) =>
        segment.type === "math" ? <MathSpan key={i} latex={segment.content} /> : <span key={i}>{segment.content}</span>,
      )}
    </p>
  );
}
