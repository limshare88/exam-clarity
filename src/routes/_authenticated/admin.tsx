import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
import { extractExamQuestions, extractMarkScheme, MARK_SCHEME_NAME_PATTERN } from "@/lib/ai.functions";
import { cropAndUploadDiagram, renderPaperPages } from "@/lib/diagram-crop";
import { FileSearch, Trash2 } from "lucide-react";


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
  const [paperType, setPaperType] = useState("");
  const [examYear, setExamYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [duplicateName, setDuplicateName] = useState<string | null>(null);
  const extractQuestions = useServerFn(extractExamQuestions);
  const readMarkScheme = useServerFn(extractMarkScheme);



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

  type Paper = {
    file_path: string;
    original_name: string;
    subject: string;
    count: number;
    created_at: string;
  };

  const { data: papers } = useQuery({
    queryKey: ["papers"],
    queryFn: async (): Promise<Paper[]> => {
      const { data } = await supabase
        .from("exam_questions")
        .select("file_path, subject, metadata, created_at")
        .not("file_path", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      const grouped = new Map<string, Paper>();
      for (const row of data ?? []) {
        const path = row.file_path as string;
        if (!path) continue;
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        const existing = grouped.get(path);
        if (existing) {
          existing.count += 1;
          continue;
        }
        grouped.set(path, {
          file_path: path,
          original_name: String(meta["original_name"] ?? path.split("/").pop() ?? "Uploaded paper"),
          subject: row.subject,
          count: 1,
          created_at: row.created_at,
        });
      }
      return Array.from(grouped.values());
    },
  });

  async function deletePaper(paper: Paper) {
    const { error } = await supabase.from("exam_questions").delete().eq("file_path", paper.file_path);
    if (error) { toast.error(error.message); return; }
    await supabase.storage.from("exam-uploads").remove([paper.file_path]);
    qc.invalidateQueries({ queryKey: ["papers"] });
    qc.invalidateQueries({ queryKey: ["questions"] });
    toast.success(`Removed every question from ${paper.original_name}.`);
  }


  async function addQuestion() {
    if (!subject) { toast.error("Choose a subject first."); return; }
    if (!questionText.trim() && !file) { toast.error("Add question text or a file."); return; }
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) { setBusy(false); toast.error("Please sign in again."); return; }

    const filePath: string | null = null;
    if (file) {
      // Duplicate check against the historical uploads log before any extraction runs.
      const { data: seen } = await supabase
        .from("exam_questions")
        .select("id")
        .eq("user_id", uid)
        .eq("metadata->>original_name", file.name)
        .limit(1);
      if (seen && seen.length) {
        setBusy(false);
        setDuplicateName(file.name);
        return;
      }

      const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("exam-uploads").upload(path, file);
      if (upErr) {
        setBusy(false);
        { toast.error(upErr.message); return; }
      }
      const board = subjects.find((s) => s.subject === subject)?.board ?? "";
      try {
        const result = await extractQuestions({
          data: { filePath: path, mimeType: file.type, subject, board },
        });

        // Cut every detected diagram out of its page and store it alongside the question.
        const diagramPages = result.questions.filter((q) => q.diagram_box).map((q) => q.page);
        const pages = diagramPages.length ? await renderPaperPages(file, diagramPages) : new Map();
        const imageUrls = new Map<number, string>();
        for (let i = 0; i < result.questions.length; i += 1) {
          const question = result.questions[i]!;
          const canvas = question.diagram_box ? pages.get(question.page) : undefined;
          if (!question.diagram_box || !canvas) continue;
          const url = await cropAndUploadDiagram(canvas, question.diagram_box, uid);
          if (url) imageUrls.set(i, url);
        }

        const chosenPaper = paperType.trim() || result.paper_type || null;
        const chosenYear = Number(examYear) || result.exam_year || null;

        const rows = result.questions.map((question, index) => ({
          user_id: uid,
          subject,
          board: board || null,
          question_text: `${question.question_number}. ${question.question_text}`,
          marks: question.marks,
          source_type: file.type.includes("pdf") ? "pdf" : "image",
          file_path: path,
          image_url: imageUrls.get(index) ?? null,
          paper_type: chosenPaper,
          exam_year: chosenYear,
          metadata: {
            question_number: question.question_number,
            extracted_by_ai: true,
            original_name: file.name,
            page: question.page,
          },
        }));
        const { error: insertError } = await supabase.from("exam_questions").insert(rows);
        if (insertError) throw new Error(insertError.message);
        setBusy(false);
        setFile(null);
        qc.invalidateQueries({ queryKey: ["questions"] });
        qc.invalidateQueries({ queryKey: ["papers"] });
        const withDiagrams = imageUrls.size;
        toast.success(
          `${rows.length} question${rows.length === 1 ? "" : "s"} saved automatically` +
            (withDiagrams ? `, ${withDiagrams} with a diagram.` : "."),
        );
        return;
      } catch (error) {
        await supabase.storage.from("exam-uploads").remove([path]);
        setBusy(false);
        toast.error(error instanceof Error ? error.message : "This paper could not be read.");
        return;
      }
    }


    const board = subjects.find((s) => s.subject === subject)?.board ?? null;
    const { error } = await supabase.from("exam_questions").insert({
      user_id: uid,
      subject,
      board,
      question_text: questionText.trim(),
      marks: Number(marks) || 1,
      source_type: "manual",
      file_path: filePath,
      paper_type: paperType.trim() || null,
      exam_year: Number(examYear) || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
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
      { toast.error("Please pick the dates for the timeframe first."); return; }
    }
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) { toast.error("Please sign in again."); return; }
    const userId = uid;

    async function purge(
      table: "session_logs" | "vocab_stumble_blocks" | "exam_questions" | "gamification_inventory",
    ) {
      const base = supabase.from(table).delete().eq("user_id", userId);
      const selectedRange = range;
      const query = selectedRange
        ? base.gte("created_at", selectedRange.start!).lt("created_at", selectedRange.end!)
        : base;
      const { error } = await query;
      return error;
    }

    if (kind === "history") {
      const error = await purge("session_logs");
      if (error) { toast.error(error.message); return; }
      await purge("vocab_stumble_blocks");
      qc.invalidateQueries({ queryKey: ["logs", 7] });
      qc.invalidateQueries({ queryKey: ["logs", 30] });
    }

    if (kind === "coins") {
      const error = await purge("gamification_inventory");
      if (error) { toast.error(error.message); return; }
      if (timeframe === "all") {
        await supabase.from("user_profiles").update({ coins: 0, stars: 0 }).eq("user_id", uid);
      }
      refreshProfile();
      qc.invalidateQueries({ queryKey: ["inventory"] });
    }

    if (kind === "questions") {
      const error = await purge("exam_questions");
      if (error) { toast.error(error.message); return; }
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="paper" className="text-base">
              Paper
            </Label>
            <Input
              id="paper"
              value={paperType}
              onChange={(e) => setPaperType(e.target.value)}
              placeholder="Paper 1"
              className="tap-lg rounded-2xl border-2 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="year" className="text-base">
              Exam year
            </Label>
            <Input
              id="year"
              type="number"
              min={1990}
              max={2100}
              value={examYear}
              onChange={(e) => setExamYear(e.target.value)}
              placeholder="2025"
              className="tap-lg rounded-2xl border-2 text-base"
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Leave Paper and Year empty to let the reader take them from the paper itself.
        </p>


        <Button onClick={addQuestion} disabled={busy} className="tap-lg w-full rounded-2xl text-base">
          <FileSearch className="mr-2 h-5 w-5" />
          {busy ? (file ? "Reading paper…" : "Saving…") : file ? "Extract questions" : "Save question"}
        </Button>
      </section>

      <section className="surface-card space-y-3 p-5">
        <div>
          <h2 className="text-xl font-bold">📚 Uploaded papers ({papers?.length ?? 0})</h2>
          <p className="text-sm text-muted-foreground">
            Questions are saved automatically when a paper is read.
          </p>
        </div>
        {(papers ?? []).map((paper) => (
          <div
            key={paper.file_path}
            className="flex items-center justify-between gap-3 rounded-2xl border-2 border-border bg-cream p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold">{paper.original_name}</p>
              <p className="text-sm text-muted-foreground">
                {paper.subject} · {paper.count} question{paper.count === 1 ? "" : "s"} ·{" "}
                {format(new Date(paper.created_at), "d MMM yyyy")}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => deletePaper(paper)}
              className="tap-lg shrink-0 rounded-2xl border-2 border-border text-sm"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete Paper
            </Button>
          </div>
        ))}
        {!papers?.length && <p className="text-muted-foreground">No papers uploaded yet.</p>}
      </section>

      <Dialog open={duplicateName !== null} onOpenChange={(o) => !o && setDuplicateName(null)}>
        <DialogContent className="rounded-3xl border-2 border-border">
          <DialogHeader>
            <DialogTitle>⚠️ This exam paper has already been uploaded to your question bank.</DialogTitle>
            <DialogDescription>
              {duplicateName} is already saved, so nothing new was added. Delete the existing paper
              first if you want to read it again.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => setDuplicateName(null)}
            className="tap-lg w-full rounded-2xl text-base"
          >
            Okay
          </Button>
        </DialogContent>
      </Dialog>


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
