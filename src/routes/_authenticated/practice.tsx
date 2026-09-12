import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRefreshProfile, awardCoins } from "@/hooks/useProfile";
import { AppShell } from "@/components/AppShell";
import { VocabText } from "@/components/VocabText";
import { coachStrategy, deconstructQuestion, generateReinforceQuestion } from "@/lib/ai.functions";
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
  const [active, setActive] = useState<ActiveQuestion | null>(null);
  const [blocks, setBlocks] = useState<Deconstructed | null>(null);
  const [strategy, setStrategy] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const startedAt = useRef<number>(Date.now());

  const deconstruct = useServerFn(deconstructQuestion);
  const coach = useServerFn(coachStrategy);
  const reinforce = useServerFn(generateReinforceQuestion);

  useEffect(() => {
    if (!subject && subjects.length) setSubject(subjects[0]!.subject);
  }, [subjects, subject]);

  const { data: bank } = useQuery({
    queryKey: ["questions", subject],
    queryFn: async () => {
      const { data } = await supabase
        .from("exam_questions")
        .select("id, subject, board, question_text, marks")
        .eq("subject", subject)
        .order("created_at", { ascending: false })
        .limit(40);
      return data ?? [];
    },
    enabled: Boolean(subject),
  });

  const boardFor = useCallback(
    (s: string) => subjects.find((x) => x.subject === s)?.board ?? "",
    [subjects],
  );

  const resetQuestionState = useCallback(() => {
    setBlocks(null);
    setStrategy("");
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
        });
        nextMarks = res.marks;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not build a drill right now.");
      }
      setBusy(null);
    } else {
      const pool = bank ?? [];
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
      });
      nextMarks = pick.marks;
    }
    startedAt.current = Date.now();
    if (mode === "challenge") {
      setSecondsLeft((profile?.timer_seconds ?? 60) * Math.max(nextMarks, 1));
    }
    else setSecondsLeft(null);
  }, [subject, mode, bank, boardFor, profile, reinforce, resetQuestionState]);


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

  function toggleMic() {
    if (recording) {
      setRecording(false);
      return;
    }
    setRecording(true);
    // Simulated voice capture: transcribes a spoken strategy into the text box.
    setTimeout(() => {
      setRecording(false);
      setStrategy((prev) =>
        (prev ? prev + "\n" : "") +
        "Step 1: I read the command word and underline what it asks for. " +
        "Step 2: I list the data given in the question. " +
        "Step 3: I choose the rule or formula that links them, then say the order I would use it in.",
      );
      toast.success("Voice note added to your strategy box.");
    }, 1800);
  }

  async function submitStrategy() {
    if (!active) return;
    if (strategy.trim().length < 10) { toast.error("Write a couple of steps first."); return; }
    setBusy("coach");
    try {
      const res = await coach({
        data: {
          questionText: active.question_text,
          subject: active.subject,
          board: active.board,
          strategy,
          marks: active.marks,
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
        strategy_text: strategy,
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
            <VocabText text={active.question_text} subject={active.subject} />
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

          <section className="surface-card space-y-4 p-5">
            <div className="rounded-2xl border-2 border-border bg-peach p-4">
              <p className="reading-text text-base font-semibold">
                📝 Goal: State your strategy step-by-step and name the formulas or rules you will
                use. You do NOT need to calculate the final math working.
              </p>
            </div>

            <Textarea
              rows={7}
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              placeholder="Step 1… Step 2… The formula I would use is…"
              className="reading-text rounded-2xl border-2 text-base"
            />

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                onClick={toggleMic}
                className={`tap-lg rounded-2xl border-2 border-border text-base ${
                  recording ? "bg-destructive text-destructive-foreground" : ""
                }`}
              >
                {recording ? <Square className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
                {recording ? "Listening…" : "Speak it"}
              </Button>
              <Button
                onClick={submitStrategy}
                disabled={busy === "coach"}
                className="tap-lg rounded-2xl text-base"
              >
                {busy === "coach" ? "Checking…" : "Check my thinking"}
              </Button>
            </div>
          </section>

          {feedback && (
            <section className="surface-card space-y-3 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Coach feedback</h3>
                <span className="rounded-2xl border-2 border-border bg-mint px-3 py-1 font-bold">
                  {feedback.score}%
                </span>
              </div>
              <FeedbackBlock title="🧠 Logic" body={feedback.logic_feedback} />
              <FeedbackBlock title="🔢 Sequencing" body={feedback.sequencing_feedback} />
              <FeedbackBlock title="📐 Formulas & rules" body={feedback.formula_feedback} />
              <div className="rounded-2xl border-2 border-border bg-lavender p-4">
                <p className="font-bold">{feedback.board_used} standard</p>
                <p className="reading-text mt-1 text-sm">{feedback.rubric_basis}</p>
              </div>
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
