import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { lookupWord } from "@/lib/ai.functions";
import { splitMathSegments, MathSpan } from "@/components/MathText";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type Card = { definition: string; everyday_example: string; subject_context: string };

export function VocabText({ text, subject }: { text: string; subject: string }) {
  const lookup = useServerFn(lookupWord);
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);

  const segments = splitMathSegments(text);

  async function handleWord(raw: string) {
    const clean = raw.replace(/[^A-Za-z'-]/g, "");
    if (clean.length < 2) return;
    setWord(clean);
    setCard(null);
    setError(null);
    setOpen(true);
    try {
      const result = await lookup({ data: { word: clean, subject, sentence: text.slice(0, 600) } });
      setCard(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this word right now.");
    }
  }

  return (
    <>
      <p className="reading-text text-lg text-foreground">
        {segments.map((segment, segIndex) =>
          segment.type === "math" ? (
            <MathSpan key={segIndex} latex={segment.content} />
          ) : (
            segment.content.split(/(\s+)/).map((token, i) =>
              /^\s+$/.test(token) ? (
                <span key={`${segIndex}-${i}`}>{token}</span>
              ) : token.length === 0 ? null : (
                <button
                  key={`${segIndex}-${i}`}
                  type="button"
                  onClick={() => handleWord(token)}
                  className="rounded-md px-0.5 py-0.5 text-left underline decoration-dotted decoration-primary/50 underline-offset-8 transition-colors hover:bg-mint focus-visible:bg-mint focus-visible:outline-none"
                >
                  {token}
                </button>
              ),
            )
          ),
        )}
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-3xl border-2 border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-2xl">{word}</DialogTitle>
            <DialogDescription className="text-sm">In {subject}</DialogDescription>
          </DialogHeader>

          {!card && !error && (
            <div className="flex items-center gap-3 py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Looking this word up…
            </div>
          )}
          {error && <p className="py-4 text-destructive">{error}</p>}
          {card && (
            <div className="space-y-4">
              <Block title="📖 Simple meaning" body={card.definition} tone="bg-cream" />
              <Block title="🏠 Everyday example" body={card.everyday_example} tone="bg-mint" />
              <Block
                title={`🔬 In ${subject}`}
                body={card.subject_context}
                tone="bg-lavender"
              />
              <p className="text-xs text-muted-foreground">
                Saved to your Stumble Blocks so it can come back in Reinforce mode.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Block({ title, body, tone }: { title: string; body: string; tone: string }) {
  return (
    <div className={`rounded-2xl border-2 border-border ${tone} p-4`}>
      <p className="mb-1 text-sm font-bold">{title}</p>
      <p className="reading-text text-base">{body}</p>
    </div>
  );
}
