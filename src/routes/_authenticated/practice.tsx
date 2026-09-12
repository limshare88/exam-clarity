import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRefreshProfile, awardCoins } from "@/hooks/useProfile";
import { AppShell } from "@/components/AppShell";
import { VocabText } from "@/components/VocabText";
import { coachStrategy, deconstructQuestion, generateReinforceQuestion } from "@/lib/ai.functions";
import { subjectStrategyRule } from "@/lib/subjects";
import { splitQuestionParts } from "@/lib/question-parts";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mic, Volume2, Square } from "lucide-react";
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

type ActiveQuestion = {
  id: string | null;
  subject: string;
  board: string;
  question_text: string;
  marks: number;
  image_url: string | null;
};


type Deconstructed = {
  core_goal: string;
  command_words: { word: string; meaning: string }[];
  facts: string[];
};

type Feedback = Awaited<ReturnType<typeof coachStrategy>>;

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
  const startedAt = useRef<number>(Date.now());
  const seen = useRef<Set<string>>(new Set());


  const deconstruct = useServerFn(deconstructQuestion);
  const coach = useServerFn(coachStrategy);
  const reinforce = useServerFn(generateReinforceQuestion);

  useEffect(() => {
    if (!subject && subjects.length) setSubject(subjects[0]!.subject);
  }, [subjects, subject]);

  const { data: bank } = useQuery({
    queryKey: ["questions", subject],
    queryFn: async () => {
      seen.current.clear();
      const { data } = await supabase
        .from("exam_questions")
        .select("id, subject, board, question_text, marks, image_url, paper_type, exam_year")
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
      });
      nextMarks = pick.marks;
    }
    startedAt.current = Date.now();
    if (mode === "challenge") {
      setSecondsLeft((profile?.timer_seconds ?? 60) * Math.max(nextMarks, 1));
    }
    else setSecondsLeft(null);
  }, [subject, mode, filteredBank, boardFor, profile, reinforce, resetQuestionState]);



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
  const answerParts = useMemo(() => parts.filter((p) => p.label), [parts]);
  const multiPart = answerParts.length > 1;

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
          question_text: p.text,
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
            {active.image_url && (
              <a
                href={active.image_url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-2xl border-2 border-border bg-card p-2"
              >
                <img
                  src={active.image_url}
                  alt={`Diagram printed with this ${active.subject} question`}
                  loading="lazy"
                  className="mx-auto max-h-80 w-auto rounded-xl object-contain"
                />
                <span className="mt-2 block text-center text-xs text-muted-foreground">
                  Tap the picture to see it larger.
                </span>
              </a>
            )}

            {multiPart ? (
              <div className="space-y-6">
                {parts.map((part, index) => (
                  <div
                    key={`${part.label}-${index}`}
                    className={part.label ? "border-l-4 border-border pl-4" : ""}
                  >
                    {part.label && (
                      <p className="mb-2 text-lg font-bold text-primary">{part.label}</p>
                    )}
                    <VocabText text={part.text} subject={active.subject} />
                  </div>
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
              answerParts.map((part) => (
                <div key={part.label} className="space-y-3 rounded-2xl border-2 border-border bg-cream p-4">
                  <p className="text-lg font-bold text-primary">{part.label}</p>
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
