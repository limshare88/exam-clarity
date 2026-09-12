import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRefreshProfile } from "@/hooks/useProfile";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Parent & teacher panel — ExamPulse" },
      {
        name: "description",
        content: "Upload past-paper questions and manage practice history, coins and question data.",
      },
      { property: "og:title", content: "Parent & teacher panel — ExamPulse" },
      { property: "og:description", content: "Upload questions and manage stored data." },
    ],
  }),
  component: Admin,
});

type ResetKind = "history" | "coins" | "questions";

const RESET_LABELS: Record<ResetKind, string> = {
  history: "🗑️ Reset Practice History",
  coins: "🪙 Reset Coins & Inventory",
  questions: "❌ Clear All Exam Questions",
};

function Admin() {
  const { data: profile } = useProfile();
  const refreshProfile = useRefreshProfile();
  const qc = useQueryClient();

  const subjects = profile?.subjects ?? [];
  const [subject, setSubject] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [marks, setMarks] = useState("3");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const [timeframe, setTimeframe] = useState<"all" | "month" | "custom">("all");
  const [month, setMonth] = useState("");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();

  const [pending, setPending] = useState<ResetKind | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const { data: questions } = useQuery({
    queryKey: ["questions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("exam_questions")
        .select("id, subject, question_text, marks, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  async function addQuestion() {
    if (!subject) return toast.error("Choose a subject first.");
    if (!questionText.trim() && !file) return toast.error("Add question text or a file.");
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user!.id;

    let filePath: string | null = null;
    if (file) {
      const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("exam-uploads").upload(path, file);
      if (upErr) {
        setBusy(false);
        return toast.error(upErr.message);
      }
      filePath = path;
    }

    const board = subjects.find((s) => s.subject === subject)?.board ?? null;
    const { error } = await supabase.from("exam_questions").insert({
      user_id: uid,
      subject,
      board,
      question_text: questionText.trim() || `Question from uploaded file: ${file?.name ?? ""}`,
      marks: Number(marks) || 1,
      source_type: file ? (file.type.includes("pdf") ? "pdf" : "image") : "manual",
      file_path: filePath,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setQuestionText("");
    setFile(null);
    qc.invalidateQueries({ queryKey: ["questions"] });
    toast.success("Question saved to the question bank.");
  }

  function windowFilter() {
    if (timeframe === "month" && month) {
      const start = new Date(`${month}-01T00:00:00`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    if (timeframe === "custom" && from && to) {
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      return { start: from.toISOString(), end: end.toISOString() };
    }
    return null;
  }

  async function runReset(kind: ResetKind) {
    const range = windowFilter();
    if (timeframe !== "all" && !range) {
      return toast.error("Please pick the dates for the timeframe first.");
    }
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user!.id;

    const applyRange = <T extends { gte: (c: string, v: string) => T; lt: (c: string, v: string) => T }>(q: T) =>
      range ? q.gte("created_at", range.start).lt("created_at", range.end) : q;

    if (kind === "history") {
      const { error } = await applyRange(
        supabase.from("session_logs").delete().eq("user_id", uid) as never,
      );
      if (error) return toast.error(error.message);
      await applyRange(supabase.from("vocab_stumble_blocks").delete().eq("user_id", uid) as never);
      qc.invalidateQueries({ queryKey: ["logs", 7] });
      qc.invalidateQueries({ queryKey: ["logs", 30] });
    }

    if (kind === "coins") {
      const { error } = await applyRange(
        supabase.from("gamification_inventory").delete().eq("user_id", uid) as never,
      );
      if (error) return toast.error(error.message);
      if (timeframe === "all") {
        await supabase.from("user_profiles").update({ coins: 0, stars: 0 }).eq("user_id", uid);
      }
      refreshProfile();
      qc.invalidateQueries({ queryKey: ["inventory"] });
    }

    if (kind === "questions") {
      const { error } = await applyRange(
        supabase.from("exam_questions").delete().eq("user_id", uid) as never,
      );
      if (error) return toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["questions"] });
    }

    toast.success("Done. Only the chosen timeframe was cleared.");
    setPending(null);
    setConfirmText("");
  }

  return (
    <AppShell title="Parent & teacher panel" subtitle="Upload papers and manage stored data">
      <section className="surface-card space-y-4 p-5">
        <h2 className="text-xl font-bold">📄 Add exam questions</h2>

        <div className="space-y-2">
          <Label className="text-base">Subject</Label>
          <Select value={subject || undefined} onValueChange={setSubject}>
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="qtext" className="text-base">
            Question text
          </Label>
          <Textarea
            id="qtext"
            rows={5}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Paste or type the past-paper question here."
            className="reading-text rounded-2xl border-2 text-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="marks" className="text-base">
              Marks
            </Label>
            <Input
              id="marks"
              type="number"
              min={1}
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              className="tap-lg rounded-2xl border-2 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file" className="text-base">
              Screenshot or PDF
            </Label>
            <Input
              id="file"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="rounded-2xl border-2 py-3 text-sm"
            />
          </div>
        </div>

        <Button onClick={addQuestion} disabled={busy} className="tap-lg w-full rounded-2xl text-base">
          {busy ? "Saving…" : "Save question"}
        </Button>
      </section>

      <section className="surface-card space-y-3 p-5">
        <h2 className="text-xl font-bold">🗂️ Question bank ({questions?.length ?? 0})</h2>
        {(questions ?? []).slice(0, 6).map((q) => (
          <div key={q.id} className="rounded-2xl border-2 border-border bg-cream p-4">
            <p className="text-sm font-semibold">
              {q.subject} · {q.marks} marks
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{q.question_text}</p>
          </div>
        ))}
        {!questions?.length && <p className="text-muted-foreground">No questions saved yet.</p>}
      </section>

      <section className="surface-card space-y-4 p-5">
        <h2 className="text-xl font-bold">🧹 Database administration</h2>

        <div className="space-y-2">
          <Label className="text-base">Select timeframe</Label>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as typeof timeframe)}>
            <SelectTrigger className="tap-lg rounded-2xl border-2 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="py-3 text-base">
                All-Time History
              </SelectItem>
              <SelectItem value="month" className="py-3 text-base">
                By Calendar Month
              </SelectItem>
              <SelectItem value="custom" className="py-3 text-base">
                Custom Date Range
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {timeframe === "month" && (
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="tap-lg rounded-2xl border-2 text-base"
          />
        )}

        {timeframe === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <DatePick label="From" value={from} onChange={setFrom} />
            <DatePick label="To" value={to} onChange={setTo} />
          </div>
        )}

        <div className="space-y-3 pt-2">
          {(Object.keys(RESET_LABELS) as ResetKind[]).map((kind) => (
            <Button
              key={kind}
              variant="secondary"
              onClick={() => {
                setPending(kind);
                setConfirmText("");
              }}
              className="tap-lg w-full rounded-2xl border-2 border-border text-base"
            >
              {RESET_LABELS[kind]}
            </Button>
          ))}
        </div>
      </section>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="rounded-3xl border-2 border-border">
          <DialogHeader>
            <DialogTitle>{pending && RESET_LABELS[pending]}</DialogTitle>
            <DialogDescription>
              This will permanently remove the matching records
              {timeframe === "all" ? " for all time" : " inside the chosen dates"}. Type RESET to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET"
            className="tap-lg rounded-2xl border-2 text-base"
          />
          <Button
            disabled={confirmText !== "RESET"}
            onClick={() => pending && runReset(pending)}
            className="tap-lg w-full rounded-2xl bg-destructive text-base text-destructive-foreground hover:bg-destructive/90"
          >
            Confirm reset
          </Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function DatePick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-base">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            className="tap-lg w-full rounded-2xl border-2 border-border text-sm"
          >
            {value ? format(value, "d MMM yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-3xl border-2 border-border p-2">
          <Calendar mode="single" selected={value} onSelect={onChange} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
