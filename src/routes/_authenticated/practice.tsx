import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRefreshProfile, awardCoins } from "@/hooks/useProfile";
import { AppShell } from "@/components/AppShell";
import { VocabText } from "@/components/VocabText";
import { askPracticeQuestion, coachStrategy, deconstructQuestion, generateReinforceQuestion, logChatDoubts } from "@/lib/ai.functions";
import { subjectStrategyRule } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { splitQuestionParts, leafParts, type QuestionPart } from "@/lib/question-parts";
import { ExamSchematic, type ExamSchematicData } from "@/components/ExamSchematic";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Volume2, Square, MessageCircleQuestion, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({
    meta: [
      { title: "Question workspace — ExamPulse" },
      {
        name: "description",
        content:
          "Practice, Challenge and Reinforce modes with read-aloud, question deconstruction and a strategy coach.",
      },
      { property: "og:title", content: "Question workspace — ExamPulse" },
      { property: "og:description", content: "Decode the question, plan the strategy, earn coins." },
    ],
  }),
  component: Workspace,
});

type Mode = "practice" | "challenge" | "reinforce";

/** One printed diagram, matched to the sub-part it illustrates by finding a verbatim
 * quote (see `anchor`) inside that part's own text — not by a structural label, since
 * asking the AI to reproduce our internal path syntax proved too unreliable across
 * inconsistently-formatted exam papers. "" means it belongs to the whole question. */
type QuestionDiagram = { anchor: string; url: string };

/** One printed per-sub-part mark allocation, matched to its sub-part the same way
 * diagrams are — a verbatim anchor quote, not a structural label. Empty for a question
 * whose board only prints one total with no per-part breakdown. */
type QuestionPartMark = { anchor: string; marks: number };

type ActiveQuestion = {
  id: string | null;
  subject: string;
  board: string;
  question_text: string;
  marks: number;
  image_url: string | null;
  diagrams: QuestionDiagram[];
  partMarks: QuestionPartMark[];
  paper_type: string | null;
  exam_year: number | null;
  schematic: ExamSchematicData | null;

};


type Deconstructed = {
  core_goal: string;
  command_words: { word: string; meaning: string }[];
  facts: string[];
};

type Feedback = Awaited<ReturnType<typeof coachStrategy>>;

/** Validates the `diagrams` jsonb column into typed entries. Falls back to the legacy
 * single `image_url` column (as one whole-question diagram) for rows saved before
 * per-part diagrams existed. */
function normalizeDiagrams(raw: unknown, imageUrl: string | null): QuestionDiagram[] {
  const list = Array.isArray(raw)
    ? raw.flatMap((entry): QuestionDiagram[] => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const url = typeof item["url"] === "string" ? item["url"] : "";
        if (!url) return [];
        return [{ anchor: typeof item["anchor"] === "string" ? item["anchor"] : "", url }];
      })
    : [];
  if (list.length) return list;
  return imageUrl ? [{ anchor: "", url: imageUrl }] : [];
}

/** Validates the `part_marks` jsonb column into typed entries. Rows saved before this
 * column existed simply have no rows for it (column default is '[]'), which is a real
 * fact -- those questions' per-part marks were discarded at extraction time and aren't
 * recoverable without re-uploading. */
function normalizePartMarks(raw: unknown): QuestionPartMark[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): QuestionPartMark[] => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const anchor = typeof item["anchor"] === "string" ? item["anchor"] : "";
    const marks = Number(item["marks"]);
    if (!anchor || !Number.isFinite(marks) || marks <= 0) return [];
    return [{ anchor, marks }];
  });
}

function Workspace() {
  const { data: profile } = useProfile();
  const refreshProfile = useRefreshProfile();
  const subjects = useMemo(() => profile?.subjects ?? [], [profile]);

  const [mode, setMode] = useState<Mode>("practice");
  const [subject, setSubject] = useState("");
  const [paperFilter, setPaperFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [active, setActive] = useState<ActiveQuestion | null>(null);
  const [blocks, setBlocks] = useState<Deconstructed | null>(null);
  const [strategy, setStrategy] = useState("");
  const [partStrategies, setPartStrategies] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatMessagesRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const startedAt = useRef<number>(Date.now());
  const seen = useRef<Set<string>>(new Set());


  const deconstruct = useServerFn(deconstructQuestion);
  const coach = useServerFn(coachStrategy);
  const reinforce = useServerFn(generateReinforceQuestion);
  const askQuestion = useServerFn(askPracticeQuestion);
  const logDoubts = useServerFn(logChatDoubts);

  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  // A chat belongs to one question. When the question changes, flush whatever doubts
  // came up in the outgoing chat (so Reinforce can draw on them later) and start fresh --
  // she asked for a clean chat per question, not one long running thread.
  useEffect(() => {
    const ctx = active ? { subject: active.subject, board: active.board, questionText: active.question_text } : null;
    return () => {
      if (ctx && chatMessagesRef.current.length) {
        void logDoubts({ data: { ...ctx, messages: chatMessagesRef.current } });
      }
      setChatMessages([]);
      setChatOpen(false);
      setChatInput("");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.question_text]);

  async function sendChatMessage() {
    if (!active || chatBusy) return;
    const message = chatInput.trim();
    if (!message) return;
    const nextMessages = [...chatMessages, { role: "user" as const, content: message }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatBusy(true);
    try {
      const res = await askQuestion({
        data: {
          subject: active.subject,
          board: active.board,
          questionText: active.question_text,
          history: chatMessages,
          message,
        },
      });
      setChatMessages([...nextMessages, { role: "assistant", content: res.reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The helper could not reply right now.");
    } finally {
      setChatBusy(false);
    }
  }

  useEffect(() => {
    if (!subject && subjects.length) setSubject(subjects[0]!.subject);
  }, [subjects, subject]);

  const { data: bank } = useQuery({
    queryKey: ["questions", subject],
    queryFn: async () => {
      seen.current.clear();
      const { data } = await supabase
        .from("exam_questions")
        .select("id, subject, board, question_text, marks, image_url, diagrams, part_marks, paper_type, exam_year")
        .eq("subject", subject)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
    enabled: Boolean(subject),
  });

  // Paper and Year choices come from what actually exists for this subject.
  const paperOptions = useMemo(
    () => Array.from(new Set((bank ?? []).map((q) => q.paper_type).filter(Boolean) as string[])).sort(),
    [bank],
  );
  const yearOptions = useMemo(() => {
    const years = (bank ?? [])
      .filter((q) => paperFilter === "all" || q.paper_type === paperFilter)
      .map((q) => q.exam_year)
      .filter((y): y is number => typeof y === "number");
    return Array.from(new Set(years)).sort((a, b) => b - a);
  }, [bank, paperFilter]);

  const filteredBank = useMemo(
    () =>
      (bank ?? []).filter(
        (q) =>
          (paperFilter === "all" || q.paper_type === paperFilter) &&
          (yearFilter === "all" || String(q.exam_year ?? "") === yearFilter),
      ),
    [bank, paperFilter, yearFilter],
  );

  // Reset the filters whenever the subject changes so stale combinations never stick.
  useEffect(() => {
    setPaperFilter("all");
    setYearFilter("all");
  }, [subject]);



  const boardFor = useCallback(
    (s: string) => subjects.find((x) => x.subject === s)?.board ?? "",
    [subjects],
  );

  const resetQuestionState = useCallback(() => {
    setBlocks(null);
    setStrategy("");
    setPartStrategies({});
    setFeedback(null);
    startedAt.current = Date.now();
  }, []);

  const loadNext = useCallback(async () => {
    if (!subject) return;
    resetQuestionState();
    let nextMarks = 1;
    if (mode === "reinforce") {
      setBusy("reinforce");
      try {
        const res = await reinforce({ data: { subject, board: boardFor(subject) } });
        setActive({
          id: null,
          subject,
          board: boardFor(subject),
          question_text: res.question_text,
          marks: res.marks,
          image_url: null,
          diagrams: [],
          partMarks: [],
          paper_type: null,
          exam_year: null,
          schematic: res.schematic,

        });
        nextMarks = res.marks;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not build a drill right now.");
      }
      setBusy(null);
    } else {
      const pool = filteredBank;
      if (!pool.length) {
        setActive(null);
        if (!bank?.length) {
          toast.error(`No questions yet for ${subject}. Upload a paper for this subject in the parent panel first.`);
        } else {
          toast.error("No questions match that paper/year filter. Try 'All papers' or 'All years'.");
        }
        return;
      }
      // Randomized, non-repeating rotation: reshuffle only once every question has been seen.
      let remaining = pool.filter((q) => !seen.current.has(q.id));
      if (!remaining.length) {
        seen.current.clear();
        remaining = pool;
      }
      const pick = remaining[Math.floor(Math.random() * remaining.length)]!;
      seen.current.add(pick.id);
      setActive({
        id: pick.id,
        subject: pick.subject,
        board: pick.board ?? boardFor(subject),
        question_text: pick.question_text,
        marks: pick.marks,
        image_url: pick.image_url ?? null,
        diagrams: normalizeDiagrams(pick.diagrams, pick.image_url ?? null),
        partMarks: normalizePartMarks(pick.part_marks),
        paper_type: pick.paper_type ?? null,
        exam_year: pick.exam_year ?? null,
        schematic: null,

      });
      nextMarks = pick.marks;
    }
    startedAt.current = Date.now();
    if (mode === "challenge") {
      setSecondsLeft((profile?.timer_seconds ?? 60) * Math.max(nextMarks, 1));
    }
    else setSecondsLeft(null);
  }, [subject, mode, filteredBank, bank, boardFor, profile, reinforce, resetQuestionState]);



  // countdown
  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  function readAloud() {
    if (!active || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(active.question_text);
    utter.rate = 0.75;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  }

  async function runDeconstruct() {
    if (!active) return;
    setBusy("deconstruct");
    try {
      const res = await deconstruct({
        data: { questionText: active.question_text, subject: active.subject },
      });
      setBlocks(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not deconstruct this question.");
    }
    setBusy(null);
  }

  const parts = useMemo(
    () => (active ? splitQuestionParts(active.question_text) : []),
    [active],
  );
  // Matches each diagram to the sub-part it illustrates by finding its anchor quote
  // inside that part's own text — using the exact same parsed tree that renders the
  // page, so a match can never point at a part that doesn't actually exist. A diagram
  // with no anchor, or whose anchor isn't found anywhere, falls back to "" (shown once
  // at the top of the question) rather than guessing wrong or disappearing.
  const diagramsByPath = useMemo(() => matchDiagramsToParts(active?.diagrams ?? [], parts), [active, parts]);
  // Only the deepest actionable questions get their own blueprint box.
  const answerParts = useMemo(() => leafParts(parts), [parts]);
  const multiPart = answerParts.length > 1;

  const partMarksByPath = useMemo(
    () => matchPartMarksToParts(active?.partMarks ?? [], parts),
    [active, parts],
  );

  // Marks per part, for the "how many steps does this need" gauge next to each blueprint
  // box. The structured, anchor-matched figure (extracted straight from the paper's own
  // per-part allocation, see part_marks) is the reliable source and is used whenever
  // present. leafParts' own text-regex parse is kept only as a secondary fallback for
  // older rows uploaded before part_marks existed. Never fabricated: a part with neither
  // gets no badge at all, since many boards only total the whole question with no
  // per-part breakdown printed anywhere.
  const partMarks = useMemo(
    () =>
      answerParts.map((p) => {
        const structured = partMarksByPath.get(p.label);
        const figure = structured ?? p.marks;
        return figure != null ? { marks: figure } : null;
      }),
    [answerParts, partMarksByPath],
  );


  const voiceNote =
    "Step 1: I read the command word and underline what it asks for. " +
    "Step 2: I list the data given in the question. " +
    "Step 3: I choose the rule or formula that links them, then say the order I would use it in.";

  function toggleMic(label: string) {
    if (recording) {
      setRecording(null);
      return;
    }
    setRecording(label);
    // Simulated voice capture: transcribes a spoken strategy into the matching step box.
    setTimeout(() => {
      setRecording(null);
      if (label === "__single") {
        setStrategy((prev) => (prev ? prev + "\n" : "") + voiceNote);
      } else {
        setPartStrategies((prev) => ({
          ...prev,
          [label]: (prev[label] ? prev[label] + "\n" : "") + voiceNote,
        }));
      }
      toast.success("Voice note added to your blueprint box.");
    }, 1800);
  }

  async function submitStrategy() {
    if (!active) return;

    const payloadParts = multiPart
      ? answerParts.map((p) => ({
          label: p.label,
          question_text: [p.context, p.text].filter(Boolean).join("\n"),
          strategy: partStrategies[p.label] ?? "",
        }))
      : [{ label: "", question_text: active.question_text, strategy }];


    const combined = multiPart
      ? payloadParts
          .map((p) => `${p.label}\n${p.strategy.trim() || "(left blank)"}`)
          .join("\n\n")
      : strategy;

    if (combined.replace(/\(left blank\)/g, "").trim().length < 10) {
      toast.error("Write a couple of steps first.");
      return;
    }

    setBusy("coach");
    try {
      const res = await coach({
        data: {
          questionText: active.question_text,
          subject: active.subject,
          board: active.board,
          strategy: combined,
          marks: active.marks,
          questionId: active.id,
          paperType: active.paper_type,
          examYear: active.exam_year,
          questionNumber: /^\s*(q?\d+[a-z()i.\s]*)/i.exec(active.question_text)?.[1]?.trim() ?? null,
          parts: payloadParts,

        },
      });
      setFeedback(res);

      const elapsed = (Date.now() - startedAt.current) / 1000;
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from("session_logs").insert({
        user_id: auth.user!.id,
        question_id: active.id,
        mode,
        subject: active.subject,
        marks: active.marks,
        time_seconds: Number(elapsed.toFixed(1)),
        score: res.score,
        strategy_text: combined,
        ai_feedback: res,
        struggle_tags: res.struggle_tags ?? [],
      });

      const beatTimer = mode === "challenge" && (secondsLeft ?? 0) > 0;
      const coins = 10 + (res.score >= 70 ? 10 : 0) + (beatTimer ? 10 : 0) + (mode === "reinforce" ? 10 : 0);
      await awardCoins(coins, res.score >= 70 ? 1 : 0);
      refreshProfile();
      toast.success(`+${coins} Pulse Coins 🪙`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The coach could not reply right now.");
    }
    setBusy(null);
  }


  const total = active && mode === "challenge"
    ? (profile?.timer_seconds ?? 60) * Math.max(active.marks, 1)
    : profile?.timer_seconds ?? 60;
  const pct = secondsLeft === null ? 0 : Math.max(0, (secondsLeft / total) * 100);
  const barColor = pct > 60 ? "bg-success" : pct > 25 ? "bg-warning" : "bg-destructive";

  return (
    <>
    <AppShell title="Question workspace" subtitle="Decode it, plan it, name your formulas">
      <section className="surface-card space-y-4 p-5">
        <div className="grid grid-cols-3 gap-2">
          {(["practice", "challenge", "reinforce"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setSecondsLeft(null);
              }}
              className={`min-h-14 rounded-2xl border-2 border-border px-2 text-sm font-bold capitalize ${
                mode === m ? "bg-primary text-primary-foreground" : "bg-cream"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {mode === "practice" && "No timer. Take all the time you need."}
          {mode === "challenge" && `Gentle countdown of ${total} seconds. No alarms.`}
          {mode === "reinforce" && "Fresh drills built from your own tricky words and patterns."}
        </p>

        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="tap-lg rounded-2xl border-2 text-base">
            <SelectValue placeholder="Choose subject" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.subject} value={s.subject} className="py-3 text-base">
                {s.subject} — {s.board}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {mode !== "reinforce" && (
          <div className="grid grid-cols-2 gap-3">
            <Select value={paperFilter} onValueChange={setPaperFilter}>
              <SelectTrigger className="tap-lg rounded-2xl border-2 text-base">
                <SelectValue placeholder="Paper" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="py-3 text-base">
                  All Papers
                </SelectItem>
                {paperOptions.map((p) => (
                  <SelectItem key={p} value={p} className="py-3 text-base">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="tap-lg rounded-2xl border-2 text-base">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="py-3 text-base">
                  All Years / Random
                </SelectItem>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)} className="py-3 text-base">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {mode !== "reinforce" && (
          <p className="text-sm text-muted-foreground">
            {filteredBank.length} question{filteredBank.length === 1 ? "" : "s"} ready in this
            selection.
          </p>
        )}


        <Button onClick={loadNext} disabled={busy !== null} className="tap-lg w-full rounded-2xl text-base">
          {busy === "reinforce" ? "Building your drill…" : "Get a question"}
        </Button>
      </section>

      {mode === "challenge" && secondsLeft !== null && (
        <div className="surface-card space-y-2 p-4">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Time left</span>
            <span>{secondsLeft}s</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {secondsLeft === 0 && (
            <p className="text-sm text-muted-foreground">Time is up. You can still finish calmly.</p>
          )}
        </div>
      )}

      {!active && (
        <section className="surface-card p-6 text-center text-muted-foreground">
          {mode === "reinforce"
            ? "Tap “Get a question” for a fresh drill."
            : "No saved questions for this subject yet. Add some in the Upload panel."}
        </section>
      )}

      {active && (
        <>
          <section className="surface-card space-y-4 p-5">
            <p className="text-sm font-semibold text-muted-foreground">
              {active.subject} · {active.board} · {active.marks} marks
            </p>
            {/* Diagrams tied to a specific sub-part render inline next to that part below;
                only whole-question ("") diagrams show here at the top. */}
            {(diagramsByPath.get("") ?? []).map((diagram, index) => (
              <DiagramImage key={`${diagram.url}-${index}`} url={diagram.url} subject={active.subject} />
            ))}
            {active.schematic && <ExamSchematic diagram={active.schematic} subject={active.subject} />}

            {multiPart ? (
              <div className="space-y-5">
                {parts.map((part, index) => (
                  <PartBlock
                    key={`${part.path}-${index}`}
                    part={part}
                    subject={active.subject}
                    diagramsByPath={diagramsByPath}
                  />
                ))}
              </div>
            ) : (
              <VocabText text={active.question_text} subject={active.subject} />
            )}


            <p className="text-xs text-muted-foreground">
              Tap any word you are unsure about for a simple meaning.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                onClick={readAloud}
                className="tap-lg rounded-2xl border-2 border-border text-base"
              >
                <Volume2 className="mr-2 h-5 w-5" /> Read aloud
              </Button>
              <Button
                onClick={runDeconstruct}
                disabled={busy === "deconstruct"}
                className="tap-lg rounded-2xl text-base"
              >
                {busy === "deconstruct" ? "Working…" : "Deconstruct"}
              </Button>
            </div>
            <Button
              variant="secondary"
              onClick={() => setChatOpen(true)}
              className="tap-lg w-full rounded-2xl border-2 border-border text-base"
            >
              <MessageCircleQuestion className="mr-2 h-5 w-5" /> Ask a question
            </Button>
          </section>

          {blocks && (
            <section className="space-y-3">
              <div className="rounded-3xl border-2 border-border bg-cream p-5">
                <h3 className="text-lg font-bold">📌 The Core Goal</h3>
                <p className="reading-text mt-2 text-base">{blocks.core_goal}</p>
              </div>
              <div className="rounded-3xl border-2 border-border bg-lavender p-5">
                <h3 className="text-lg font-bold">⚙️ Command Words</h3>
                <ul className="mt-2 space-y-2">
                  {blocks.command_words.map((c) => (
                    <li key={c.word} className="reading-text text-base">
                      <strong>{c.word}</strong> — {c.meaning}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl border-2 border-border bg-mint p-5">
                <h3 className="text-lg font-bold">🧪 Extracted Facts / Data</h3>
                <ul className="mt-2 list-disc space-y-2 pl-5">
                  {blocks.facts.map((f, i) => (
                    <li key={i} className="reading-text text-base">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <section className="surface-card space-y-5 p-5">
            <div className="rounded-2xl border-2 border-border bg-peach p-4">
              <p className="reading-text text-base font-semibold">
                📝 Goal: State your strategy step-by-step and name the formulas or rules you will
                use. {subjectStrategyRule(active?.subject ?? subject)}
              </p>
              {multiPart && (
                <p className="reading-text mt-2 text-base">
                  This question has {answerParts.length} parts. Fill in one blueprint box per part.
                </p>
              )}
            </div>

            {multiPart ? (
              answerParts.map((part, index) => (
                <div key={part.label} className="space-y-3 rounded-2xl border-2 border-border bg-cream p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-bold text-primary">{part.label}</p>
                    {partMarks[index] && (
                      <span
                        className="rounded-full border-2 border-border bg-card px-2 py-0.5 text-xs font-bold text-muted-foreground"
                        title="Marks printed for this part"
                      >
                        {partMarks[index]!.marks} marks
                      </span>
                    )}
                  </div>
                  {part.context && (
                    <p className="reading-text text-sm text-muted-foreground">{part.context}</p>
                  )}
                  <p className="reading-text text-sm text-muted-foreground">{part.text}</p>

                  <Textarea
                    rows={5}
                    value={partStrategies[part.label] ?? ""}
                    onChange={(e) =>
                      setPartStrategies((prev) => ({ ...prev, [part.label]: e.target.value }))
                    }
                    placeholder={`Blueprint for ${part.label}: Step 1… Step 2… The formula I would use is…`}
                    className="reading-text rounded-2xl border-2 bg-card text-base"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => toggleMic(part.label)}
                    className={`tap-lg w-full rounded-2xl border-2 border-border text-base ${
                      recording === part.label ? "bg-destructive text-destructive-foreground" : ""
                    }`}
                  >
                    {recording === part.label ? (
                      <Square className="mr-2 h-5 w-5" />
                    ) : (
                      <Mic className="mr-2 h-5 w-5" />
                    )}
                    {recording === part.label ? "Listening…" : `Speak ${part.label}`}
                  </Button>
                </div>
              ))
            ) : (
              <>
                <Textarea
                  rows={7}
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  placeholder="Step 1… Step 2… The formula I would use is…"
                  className="reading-text rounded-2xl border-2 text-base"
                />
                <Button
                  variant="secondary"
                  onClick={() => toggleMic("__single")}
                  className={`tap-lg w-full rounded-2xl border-2 border-border text-base ${
                    recording ? "bg-destructive text-destructive-foreground" : ""
                  }`}
                >
                  {recording ? <Square className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
                  {recording ? "Listening…" : "Speak it"}
                </Button>
              </>
            )}

            <Button
              onClick={submitStrategy}
              disabled={busy === "coach"}
              className="tap-lg w-full rounded-2xl text-base"
            >
              {busy === "coach" ? "Checking…" : "Check my thinking"}
            </Button>
          </section>

          {feedback && (
            <section className="surface-card space-y-3 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Coach feedback</h3>
                <span className="rounded-2xl border-2 border-border bg-mint px-3 py-1 font-bold">
                  {feedback.score}%
                </span>
              </div>

              {feedback.part_feedback?.length ? (
                feedback.part_feedback.map((part, index) => (
                  <div
                    key={`${part.label}-${index}`}
                    className="space-y-3 rounded-3xl border-2 border-border bg-cream p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold text-primary">{part.label || "This question"}</p>
                      <span className="rounded-2xl border-2 border-border bg-mint px-3 py-1 font-bold">
                        {part.score}%
                      </span>
                    </div>
                    <FeedbackBlock title="🧠 Logic" body={part.logic_feedback} />
                    <FeedbackBlock title="🔢 Sequencing" body={part.sequencing_feedback} />
                    <FeedbackBlock title="📐 Formulas & rules" body={part.formula_feedback} />
                    {part.model_steps?.length > 0 && (
                      <div className="rounded-2xl border-2 border-border bg-card p-4">
                        <p className="font-bold">✅ The correct step order</p>
                        <ol className="mt-2 space-y-3">
                          {part.model_steps.map((s) => (
                            <li key={s.step}>
                              <p className="reading-text text-base font-semibold">
                                Step {s.step}: {s.action}
                              </p>
                              {s.reason && <p className="reading-text mt-0.5 text-sm text-muted-foreground">{s.reason}</p>}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {part.missing_steps?.length > 0 && (
                      <div className="rounded-2xl border-2 border-border bg-card p-4">
                        <p className="font-bold">➕ Steps to add next time</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {part.missing_steps.map((s, i) => (
                            <li key={i} className="reading-text text-base">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <>
                  <FeedbackBlock title="🧠 Logic" body={feedback.logic_feedback} />
                  <FeedbackBlock title="🔢 Sequencing" body={feedback.sequencing_feedback} />
                  <FeedbackBlock title="📐 Formulas & rules" body={feedback.formula_feedback} />
                  {feedback.model_steps?.length > 0 && (
                    <div className="rounded-2xl border-2 border-border bg-cream p-4">
                      <p className="font-bold">✅ The correct step order</p>
                      <ol className="mt-2 space-y-3">
                        {feedback.model_steps.map((s) => (
                          <li key={s.step}>
                            <p className="reading-text text-base font-semibold">
                              Step {s.step}: {s.action}
                            </p>
                            {s.reason && <p className="reading-text mt-0.5 text-sm text-muted-foreground">{s.reason}</p>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {feedback.missing_steps?.length > 0 && (
                    <div className="rounded-2xl border-2 border-border bg-cream p-4">
                      <p className="font-bold">➕ Steps to add next time</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {feedback.missing_steps.map((s, i) => (
                          <li key={i} className="reading-text text-base">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              <div className="rounded-2xl border-2 border-border bg-lavender p-4">
                <p className="font-bold">{feedback.board_used} standard</p>
                <p className="reading-text mt-1 text-sm">{feedback.rubric_basis}</p>
              </div>
              <p className="reading-text rounded-2xl border-2 border-border bg-mint p-4 text-base">
                💚 {feedback.encouragement}
              </p>
              <Button onClick={loadNext} className="tap-lg w-full rounded-2xl text-base">
                Next question
              </Button>
            </section>
          )}

        </>
      )}
    </AppShell>

    <Sheet open={chatOpen} onOpenChange={setChatOpen}>
      <SheetContent side="bottom" className="flex h-[85vh] flex-col rounded-t-3xl border-2 border-border">
        <SheetHeader className="text-left">
          <SheetTitle>Ask a question</SheetTitle>
          <SheetDescription>
            About this question, or {subject || "this subject"} in general. Starts fresh on your next question.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="-mx-1 flex-1 px-1">
          <div className="space-y-3 py-2">
            {chatMessages.length === 0 && (
              <p className="rounded-2xl border-2 border-dashed border-border bg-cream p-4 text-center text-sm text-muted-foreground">
                Ask anything about this question, or about {subject || "this subject"}.
              </p>
            )}
            {chatMessages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl border-2 p-3 text-base",
                  m.role === "user"
                    ? "ml-auto border-primary bg-primary/10"
                    : "mr-auto border-border bg-cream",
                )}
              >
                {m.content}
              </div>
            ))}
            {chatBusy && (
              <div className="mr-auto max-w-[85%] rounded-2xl border-2 border-border bg-cream p-3 text-base text-muted-foreground">
                Thinking…
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-end gap-2 pt-2">
          <Textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendChatMessage();
              }
            }}
            placeholder={`Ask about this question or ${subject || "this subject"}...`}
            className="min-h-12 flex-1 resize-none rounded-2xl border-2 text-base"
            disabled={chatBusy}
          />
          <Button
            onClick={() => void sendChatMessage()}
            disabled={chatBusy || !chatInput.trim()}
            className="tap-lg rounded-2xl"
            size="icon"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Anchors shorter than this are too likely to appear by coincidence in the wrong part
 * (or in several parts at once), so they're treated as "no reliable match" rather than
 * risking a wrong placement. */
const MIN_ANCHOR_LENGTH = 12;

/** Matches each diagram to the sub-part whose own text contains its anchor quote, using
 * the same parsed tree that renders the page — so a match is always to a part that
 * genuinely exists with genuinely matching text, never a guessed structural label. Falls
 * back to "" (rendered once at the top of the question) when a diagram has no anchor, the
 * anchor is too short to trust, or it isn't found anywhere in this question's text. */
function matchDiagramsToParts(diagrams: QuestionDiagram[], parts: QuestionPart[]): Map<string, QuestionDiagram[]> {
  const flat: { path: string; depth: number; text: string }[] = [];
  const walk = (node: QuestionPart) => {
    if (node.text) flat.push({ path: node.path, depth: node.depth, text: normalizeForMatch(node.text) });
    node.children.forEach(walk);
  };
  parts.forEach(walk);

  const map = new Map<string, QuestionDiagram[]>();
  const addTo = (path: string, diagram: QuestionDiagram) => {
    const existing = map.get(path);
    if (existing) existing.push(diagram);
    else map.set(path, [diagram]);
  };

  for (const diagram of diagrams) {
    const anchor = normalizeForMatch(diagram.anchor);
    if (anchor.length < MIN_ANCHOR_LENGTH) {
      addTo("", diagram);
      continue;
    }
    // Several parts could coincidentally contain the same short phrase; prefer the most
    // specific (deepest) match, since that's the part the diagram is actually printed next to.
    let best: { path: string; depth: number } | null = null;
    for (const part of flat) {
      if (part.text.includes(anchor) && (!best || part.depth > best.depth)) {
        best = { path: part.path, depth: part.depth };
      }
    }
    addTo(best?.path ?? "", diagram);
  }
  return map;
}

/** Matches each printed per-part mark allocation to the sub-part whose own text contains
 * its anchor quote — same reliable approach as matchDiagramsToParts. Unlike diagrams, a
 * mark figure always belongs to one specific labelled part, never the question as a
 * whole, so an anchor that's too short to trust or isn't found anywhere is simply
 * dropped rather than falling back to "". */
function matchPartMarksToParts(partMarks: QuestionPartMark[], parts: QuestionPart[]): Map<string, number> {
  const flat: { path: string; depth: number; text: string }[] = [];
  const walk = (node: QuestionPart) => {
    if (node.text) flat.push({ path: node.path, depth: node.depth, text: normalizeForMatch(node.text) });
    node.children.forEach(walk);
  };
  parts.forEach(walk);

  const map = new Map<string, number>();
  for (const pm of partMarks) {
    const anchor = normalizeForMatch(pm.anchor);
    if (anchor.length < MIN_ANCHOR_LENGTH) continue;
    let best: { path: string; depth: number } | null = null;
    for (const part of flat) {
      if (part.text.includes(anchor) && (!best || part.depth > best.depth)) {
        best = { path: part.path, depth: part.depth };
      }
    }
    if (best) map.set(best.path, pm.marks);
  }
  return map;
}

function DiagramImage({ url, subject }: { url: string; subject: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="block w-full overflow-hidden rounded-2xl border-2 border-border bg-card p-2 text-left"
        >
          <img
            src={url}
            alt={`Diagram printed with this ${subject} question`}
            loading="lazy"
            className="mx-auto max-h-80 w-auto rounded-xl object-contain"
          />
          <span className="mt-2 block text-center text-xs text-muted-foreground">
            Tap the picture to see it larger.
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Picture from the exam paper</DialogTitle>
          <DialogDescription>Pinch or scroll to look closely, then close this box.</DialogDescription>
        </DialogHeader>
        <img
          src={url}
          alt={`Enlarged diagram printed with this ${subject} question`}
          className="max-h-[70vh] w-full rounded-xl bg-card object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}

function PartBlock({
  part,
  subject,
  diagramsByPath,
}: {
  part: QuestionPart;
  subject: string;
  diagramsByPath: Map<string, QuestionDiagram[]>;
}) {
  const nested = part.depth > 0;
  // The root stem's own diagrams (path "") are already shown at the top of the question,
  // so only look up diagrams here for parts with a real printed label.
  const ownDiagrams = part.path ? (diagramsByPath.get(part.path) ?? []) : [];
  return (
    <div
      className={
        nested
          ? "mt-4 border-l-4 border-border/70 pl-4"
          : part.label
            ? "rounded-2xl border-2 border-border bg-card/60 p-4"
            : ""
      }
    >
      {part.label && <p className="mb-2 text-lg font-bold text-primary">{part.label}</p>}
      {part.text && <VocabText text={part.text} subject={subject} />}
      {ownDiagrams.length > 0 && (
        <div className="mt-3 space-y-3">
          {ownDiagrams.map((diagram, index) => (
            <DiagramImage key={`${diagram.url}-${index}`} url={diagram.url} subject={subject} />
          ))}
        </div>
      )}
      {part.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {part.children.map((child, index) => (
            <PartBlock
              key={`${child.path}-${index}`}
              part={child}
              subject={subject}
              diagramsByPath={diagramsByPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function FeedbackBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-lavender p-4">
      <p className="font-bold">{title}</p>
      <p className="reading-text mt-1 text-base">{body}</p>
    </div>
  );
}
