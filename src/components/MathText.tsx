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

export function splitMathSegments(text: string): TextSegment[] {
  return text
    .split(MATH_SPLIT)
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = /^\$([^$\n]+)\$$/.exec(part);
      return match?.[1] ? { type: "math" as const, content: match[1] } : { type: "text" as const, content: part };
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
