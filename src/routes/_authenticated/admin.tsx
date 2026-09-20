import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
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
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cropAndUploadDiagram, renderPaperPages, type DiagramBox } from "@/lib/diagram-crop";
import { ChevronDown, FileSearch, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cleanPaperLabel, normalizePaperLabel } from "@/lib/paper";
import { fetchAllRows } from "@/lib/fetch-all";


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
  const [paperType, setPaperType] = useState("");
  const [examYear, setExamYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [duplicateName, setDuplicateName] = useState<string | null>(null);
  const [duplicateKind, setDuplicateKind] = useState<"paper" | "scheme">("paper");
  const extractQuestions = useServerFn(extractExamQuestions);
  const readMarkScheme = useServerFn(extractMarkScheme);



  const [timeframe, setTimeframe] = useState<"all" | "month" | "custom">("all");
  const [month, setMonth] = useState("");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();

  const [pending, setPending] = useState<ResetKind | null>(null);
  const [confirmText, setConfirmText] = useState("");

  // Fixing a diagram whose auto-detected crop came out wrong (e.g. cropped blank, or the
  // wrong region of the page): pick a paper, see which of its questions have diagrams,
  // then re-draw the box for one directly over the real PDF page.
  type StoredDiagram = { anchor: string; page?: number; url: string };
  const [fixPaper, setFixPaper] = useState<Paper | null>(null);
  const [recrop, setRecrop] = useState<{
    questionId: string;
    diagramIndex: number;
    diagram: StoredDiagram;
    filePath: string;
    fallbackPage: number;
  } | null>(null);

  const { data: diagramQuestions } = useQuery({
    queryKey: ["diagram-questions", fixPaper?.file_path],
    queryFn: async () => {
      if (!fixPaper) return [];
      const { data } = await supabase
        .from("exam_questions")
        .select("id, question_text, diagrams, metadata")
        .eq("file_path", fixPaper.file_path)
        .order("created_at", { ascending: true });
      return (data ?? [])
        .map((row) => ({
          id: row.id as string,
          question_text: row.question_text as string,
          diagrams: (Array.isArray(row.diagrams) ? row.diagrams : []) as StoredDiagram[],
          page: Number((row.metadata as Record<string, unknown> | null)?.["page"] ?? 1) || 1,
        }))
        .filter((row) => row.diagrams.length > 0);
    },
    enabled: !!fixPaper,
  });

  async function saveRecrop(box: DiagramBox, canvas: HTMLCanvasElement) {
    if (!recrop) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) { toast.error("Please sign in again."); return; }

    const url = await cropAndUploadDiagram(canvas, box, uid);
    if (!url) { toast.error("Could not save that crop — try drawing a slightly larger box."); return; }

    const { data: current, error: readError } = await supabase
      .from("exam_questions")
      .select("diagrams")
      .eq("id", recrop.questionId)
      .single();
    if (readError || !current) { toast.error("Could not find that question anymore."); return; }

    const diagrams = (Array.isArray(current.diagrams) ? current.diagrams : []) as StoredDiagram[];
    if (!diagrams[recrop.diagramIndex]) { toast.error("That diagram no longer exists."); return; }
    diagrams[recrop.diagramIndex] = { ...diagrams[recrop.diagramIndex]!, url };

    const { error: updateError } = await supabase
      .from("exam_questions")
      .update({ diagrams })
      .eq("id", recrop.questionId);
    if (updateError) { toast.error(updateError.message); return; }

    qc.invalidateQueries({ queryKey: ["diagram-questions", fixPaper?.file_path] });
    qc.invalidateQueries({ queryKey: ["questions"] });
    setRecrop(null);
    toast.success("Diagram updated.");
  }

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
    exam_year: number | null;
    count: number;
    created_at: string;
  };

  const { data: papers } = useQuery({
    queryKey: ["papers"],
    queryFn: async (): Promise<Paper[]> => {
      // No row cap: every saved question is read (in pages) so no uploaded paper drops out.
      const data = await fetchAllRows((from, to) =>
        supabase
          .from("exam_questions")
          .select("file_path, subject, exam_year, metadata, created_at")
          .not("file_path", "is", null)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
      );
      const grouped = new Map<string, Paper>();
      for (const row of data) {
        const path = row.file_path as string;
        if (!path) continue;
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        const existing = grouped.get(path);
        if (existing) {
          existing.count += 1;
          if (existing.exam_year == null && typeof row.exam_year === "number") existing.exam_year = row.exam_year;
          continue;
        }
        grouped.set(path, {
          file_path: path,
          original_name: String(meta["original_name"] ?? path.split("/").pop() ?? "Uploaded paper"),
          subject: row.subject,
          exam_year: typeof row.exam_year === "number" ? row.exam_year : null,
          count: 1,
          created_at: row.created_at,
        });
      }
      return Array.from(grouped.values());
    },
  });

  const { data: schemes } = useQuery({
    queryKey: ["mark-schemes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("mark_schemes")
        .select("id, subject, paper_type, exam_year, original_name, entries, file_path")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function deleteScheme(id: string, filePath: string | null) {
    const { error } = await supabase.from("mark_schemes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (filePath) await supabase.storage.from("exam-uploads").remove([filePath]);
    qc.invalidateQueries({ queryKey: ["mark-schemes"] });
    toast.success("Marking scheme removed.");
  }


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
        setDuplicateKind("paper");
        setDuplicateName(file.name);
        return;
      }
      // Same check for marking schemes, so re-uploading one never silently replaces it.
      const { data: seenScheme } = await supabase
        .from("mark_schemes")
        .select("id")
        .eq("user_id", uid)
        .eq("original_name", file.name)
        .limit(1);
      if (seenScheme && seenScheme.length) {
        setBusy(false);
        setDuplicateKind("scheme");
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
      const schemePayload = {
        filePath: path,
        mimeType: file.type,
        subject,
        board,
        fileName: file.name,
        paperType: paperType.trim() || undefined,
        examYear: Number(examYear) || null,
      };

      async function saveScheme(): Promise<boolean> {
        const scheme = await readMarkScheme({ data: schemePayload });
        if (!scheme.detected) return false;
        qc.invalidateQueries({ queryKey: ["mark-schemes"] });
        toast.success(
          `Marking scheme saved for ${subject}${scheme.paper_type ? ` · ${scheme.paper_type}` : ""}${scheme.exam_year ? ` · ${scheme.exam_year}` : ""}. The coach will mark against it.`,
        );
        return true;
      }

      try {
        // Marking schemes hold answers, not numbered questions — read them a different way.
        if (MARK_SCHEME_NAME_PATTERN.test(file.name) && (await saveScheme())) {
          setBusy(false);
          setFile(null);
          return;
        }

        let result;
        try {
          result = await extractQuestions({
            data: { filePath: path, mimeType: file.type, subject, board },
          });
        } catch (questionError) {
          // No printed questions: it may still be a marking scheme the filename did not flag.
          if (await saveScheme()) {
            setBusy(false);
            setFile(null);
            return;
          }
          throw questionError;
        }


        // Cut every detected diagram out of its OWN page and store it alongside the
        // question. A question can have more than one diagram (e.g. an answer-options
        // table for one sub-part and a separate graph for another) spread across more
        // than one printed page if the question itself spans pages, so each diagram is
        // rendered and cropped from its own recorded page — never assumed to share the
        // question's opening page, which would crop it from the wrong page entirely.
        const diagramPages = result.questions.flatMap((q) => q.diagrams.map((d) => d.page));
        const pages = diagramPages.length ? await renderPaperPages(file, diagramPages) : new Map();
        const diagramsByQuestion = new Map<number, { anchor: string; page: number; url: string }[]>();
        for (let i = 0; i < result.questions.length; i += 1) {
          const question = result.questions[i]!;
          if (!question.diagrams.length) continue;
          const cropped: { anchor: string; page: number; url: string }[] = [];
          for (const diagram of question.diagrams) {
            const canvas = pages.get(diagram.page);
            if (!canvas) continue;
            const url = await cropAndUploadDiagram(canvas, diagram.box, uid);
            if (url) cropped.push({ anchor: diagram.anchor, page: diagram.page, url });
          }
          if (cropped.length) diagramsByQuestion.set(i, cropped);
        }

        // Typed/picked value wins. If blank, use the extracted cover text ONLY when it clearly
        // names a paper number (e.g. "Pure Mathematics P1" -> "Paper 1"); otherwise store none
        // rather than a messy raw title.
        const chosenPaper = normalizePaperLabel(paperType) || cleanPaperLabel(result.paper_type) || null;
        const chosenYear = Number(examYear) || result.exam_year || null;

        const rows = result.questions.map((question, index) => {
          const diagrams = diagramsByQuestion.get(index) ?? [];
          return {
            user_id: uid,
            subject,
            board: board || null,
            question_text: `${question.question_number}. ${question.question_text}`,
            marks: question.marks,
            source_type: file.type.includes("pdf") ? "pdf" : "image",
            file_path: path,
            // Kept for backward compatibility with older reads of this column; new
            // rendering uses `diagrams`. Falls back to the whole-question ("") diagram,
            // or the first one, so old code paths still show something.
            image_url: diagrams.find((d) => !d.anchor)?.url ?? diagrams[0]?.url ?? null,
            diagrams,
            part_marks: question.part_marks,
            paper_type: chosenPaper,
            exam_year: chosenYear,
            metadata: {
              question_number: question.question_number,
              extracted_by_ai: true,
              original_name: file.name,
              page: question.page,
            },
          };
        });
        const { error: insertError } = await supabase.from("exam_questions").insert(rows);
        if (insertError) throw new Error(insertError.message);
        setBusy(false);
        setFile(null);
        qc.invalidateQueries({ queryKey: ["questions"] });
        qc.invalidateQueries({ queryKey: ["papers"] });
        const withDiagrams = rows.filter((r) => r.diagrams.length > 0).length;
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="paper" className="text-base">
              Paper
            </Label>
            <PaperPicker value={paperType} onChange={setPaperType} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="year" className="text-base">
              Exam year
            </Label>
            <YearPicker value={examYear} onChange={setExamYear} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Pick the Paper so it appears in the Practice tab. Leave Year empty to let the reader take it from the paper itself.
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
        <GroupedHistory
          items={papers ?? []}
          getSubject={(p) => p.subject}
          getYear={(p) => p.exam_year}
          getKey={(p) => p.file_path}
          renderItem={(paper) => (
          <div
            className="flex flex-col gap-3 rounded-2xl border-2 border-border bg-cream p-4"
          >
            <div className="min-w-0">
              <p className="font-semibold [overflow-wrap:anywhere]">{paper.original_name}</p>
              <p className="text-sm text-muted-foreground">
                {paper.subject} · {paper.count} question{paper.count === 1 ? "" : "s"} ·{" "}
                {format(new Date(paper.created_at), "d MMM yyyy")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => setFixPaper(paper)}
                className="tap-lg rounded-2xl border-2 border-border text-sm"
              >
                🖼️ Fix diagrams
              </Button>
              <Button
                variant="secondary"
                onClick={() => deletePaper(paper)}
                className="tap-lg rounded-2xl border-2 border-border text-sm"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete Paper
              </Button>
            </div>
          </div>
          )}
        />
        {!papers?.length && <p className="text-muted-foreground">No papers uploaded yet.</p>}
      </section>

      <section className="surface-card space-y-3 p-5">
        <div>
          <h2 className="text-xl font-bold">✅ Marking schemes ({schemes?.length ?? 0})</h2>
          <p className="text-sm text-muted-foreground">
            Upload a mark scheme file and it is linked to the matching subject, paper and year, then used when
            marking her strategies.
          </p>
        </div>
        <GroupedHistory
          items={schemes ?? []}
          getSubject={(sc) => sc.subject}
          getYear={(sc) => sc.exam_year ?? null}
          getKey={(sc) => sc.id}
          renderItem={(scheme) => (
          <div
            className="flex items-center justify-between gap-3 rounded-2xl border-2 border-border bg-cream p-4"
          >
            <div className="min-w-0">
              <p className="font-semibold [overflow-wrap:anywhere]">{scheme.original_name ?? "Marking scheme"}</p>
              <p className="text-sm text-muted-foreground">
                {scheme.subject}
                {scheme.paper_type ? ` · ${scheme.paper_type}` : ""}
                {scheme.exam_year ? ` · ${scheme.exam_year}` : ""} ·{" "}
                {(Array.isArray(scheme.entries) ? scheme.entries.length : 0)} marking entries
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => deleteScheme(scheme.id, scheme.file_path)}
              className="tap-lg shrink-0 rounded-2xl border-2 border-border text-sm"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
          </div>
          )}
        />
        {!schemes?.length && <p className="text-muted-foreground">No marking schemes uploaded yet.</p>}
      </section>



      <Dialog open={duplicateName !== null} onOpenChange={(o) => !o && setDuplicateName(null)}>
        <DialogContent className="rounded-3xl border-2 border-border">
          <DialogHeader>
            <DialogTitle>
              {duplicateKind === "scheme"
                ? "⚠️ This marking scheme has already been uploaded."
                : "⚠️ This exam paper has already been uploaded to your question bank."}
            </DialogTitle>
            <DialogDescription>
              {duplicateName} is already saved, so nothing new was added. Delete the existing{" "}
              {duplicateKind === "scheme" ? "marking scheme" : "paper"} first if you want to read it again.
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

      <Dialog open={!!fixPaper} onOpenChange={(o) => !o && setFixPaper(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-3xl border-2 border-border">
          <DialogHeader>
            <DialogTitle>🖼️ Fix diagrams — {fixPaper?.original_name}</DialogTitle>
            <DialogDescription>
              If a diagram cropped wrong or blank, redraw its box directly over the real page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(diagramQuestions ?? []).map((q) =>
              q.diagrams.map((diagram, index) => (
                <div
                  key={`${q.id}-${index}`}
                  className="flex items-center gap-3 rounded-2xl border-2 border-border bg-cream p-3"
                >
                  <img
                    src={diagram.url}
                    alt="Current crop"
                    className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
                  />
                  <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {diagram.anchor || q.question_text.slice(0, 60)}
                  </p>
                  <Button
                    variant="secondary"
                    className="tap-lg shrink-0 rounded-2xl border-2 border-border text-sm"
                    onClick={() =>
                      setRecrop({
                        questionId: q.id,
                        diagramIndex: index,
                        diagram,
                        filePath: fixPaper!.file_path,
                        fallbackPage: q.page,
                      })
                    }
                  >
                    Recrop
                  </Button>
                </div>
              )),
            )}
            {diagramQuestions && diagramQuestions.length === 0 && (
              <p className="text-muted-foreground">No diagrams recorded for this paper.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!recrop} onOpenChange={(o) => !o && setRecrop(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl border-2 border-border">
          <DialogHeader>
            <DialogTitle>Redraw the crop</DialogTitle>
            <DialogDescription>
              Drag over the picture to select the area to keep, then save.
            </DialogDescription>
          </DialogHeader>
          {recrop && (
            <DiagramRecropEditor
              key={`${recrop.questionId}-${recrop.diagramIndex}`}
              filePath={recrop.filePath}
              initialPage={recrop.diagram.page ?? recrop.fallbackPage}
              onSave={saveRecrop}
              onCancel={() => setRecrop(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/** A paper field that can be typed into directly or picked from a dropdown of the
 * standard "Paper N" options — free typing stays available for anything that doesn't
 * fit that pattern (e.g. a named unit or a board that labels papers differently). */
function PaperPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const options = Array.from({ length: 7 }, (_, i) => `Paper ${i + 1}`);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          id="paper"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Paper 1"
          className="tap-lg rounded-2xl border-2 text-base"
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-60 w-40 overflow-y-auto rounded-2xl border-2 border-border p-1"
      >
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => {
              onChange(o);
              setOpen(false);
            }}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-cream"
          >
            {o}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** A year field that can be typed into directly or picked from a dropdown of recent
 * years — some past papers are older than any reasonable dropdown range, so free typing
 * always stays available rather than restricting to only listed years. */
function YearPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const thisYear = new Date().getFullYear();
  // Next year (for freshly-published specimen papers) down to 20 years back.
  const years = Array.from({ length: 22 }, (_, i) => thisYear + 1 - i);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          id="year"
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onFocus={() => setOpen(true)}
          placeholder="2025"
          className="tap-lg rounded-2xl border-2 text-base"
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-60 w-40 overflow-y-auto rounded-2xl border-2 border-border p-1"
      >
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => {
              onChange(String(y));
              setOpen(false);
            }}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-cream"
          >
            {y}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function DiagramRecropEditor({
  filePath,
  initialPage,
  onSave,
  onCancel,
}: {
  filePath: string;
  initialPage: number;
  onSave: (box: DiagramBox, canvas: HTMLCanvasElement) => Promise<void>;
  onCancel: () => void;
}) {
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null);
  // The selection box, kept in DISPLAY pixel coordinates while dragging; converted to
  // page-fraction coordinates (resolution-independent, matching how boxes are stored
  // everywhere else) only at save time.
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCanvas(null);
    setImgSrc(null);
    setBox(null);
    (async () => {
      const { data, error } = await supabase.storage.from("exam-uploads").download(filePath);
      if (cancelled) return;
      if (error || !data) {
        toast.error("Could not load the original paper.");
        setLoading(false);
        return;
      }
      const file = new File([data], "paper.pdf", { type: data.type || "application/pdf" });
      const pages = await renderPaperPages(file, [page]);
      if (cancelled) return;
      const rendered = pages.get(page);
      if (!rendered) {
        toast.error(`Page ${page} could not be found in this paper.`);
        setLoading(false);
        return;
      }
      setCanvas(rendered);
      const maxWidth = 640;
      const scale = Math.min(1, maxWidth / rendered.width);
      setDisplaySize({ width: Math.round(rendered.width * scale), height: Math.round(rendered.height * scale) });
      setImgSrc(rendered.toDataURL("image/png"));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [filePath, page]);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    dragStart.current = { x, y };
    setBox({ x, y, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStart.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
    const start = dragStart.current;
    setBox({ x: Math.min(start.x, x), y: Math.min(start.y, y), w: Math.abs(x - start.x), h: Math.abs(y - start.y) });
  }

  function handlePointerUp() {
    dragStart.current = null;
  }

  async function handleSave() {
    if (!canvas || !box || !displaySize || box.w < 8 || box.h < 8) {
      toast.error("Drag out a box over the picture first.");
      return;
    }
    setSaving(true);
    const fraction: DiagramBox = {
      x: box.x / displaySize.width,
      y: box.y / displaySize.height,
      w: box.w / displaySize.width,
      h: box.h / displaySize.height,
    };
    await onSave(fraction, canvas);
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-sm">Page</Label>
        <Input
          type="number"
          min={1}
          value={page}
          onChange={(e) => setPage(Math.max(1, Number(e.target.value) || 1))}
          className="w-20 rounded-xl border-2 border-border text-sm"
        />
        <p className="text-xs text-muted-foreground">Change this if the picture isn't on the page shown below.</p>
      </div>

      {loading && <p className="text-muted-foreground">Loading the page…</p>}

      {!loading && imgSrc && displaySize && (
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative touch-none select-none overflow-hidden rounded-2xl border-2 border-border"
          style={{ width: displaySize.width, height: displaySize.height }}
        >
          <img src={imgSrc} alt="Exam page" draggable={false} className="pointer-events-none block h-full w-full" />
          {box && (
            <div
              className="absolute border-2 border-primary bg-primary/20"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            />
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} className="tap-lg rounded-2xl border-2 border-border">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !box} className="tap-lg rounded-2xl">
          {saving ? "Saving…" : "Save crop"}
        </Button>
      </div>
    </div>
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

/** Collapsible history: one folder per subject, and inside it one folder per exam year
 * (newest first, "Year not set" last). Everything starts closed so a long upload history
 * stays short; tap a folder to open it. */
function GroupedHistory<T>({
  items,
  getSubject,
  getYear,
  getKey,
  renderItem,
}: {
  items: T[];
  getSubject: (item: T) => string;
  getYear: (item: T) => number | null;
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
}) {
  const bySubject = new Map<string, Map<number | null, T[]>>();
  for (const item of items) {
    const subject = getSubject(item) || "No subject";
    const year = getYear(item);
    const years = bySubject.get(subject) ?? new Map<number | null, T[]>();
    years.set(year, [...(years.get(year) ?? []), item]);
    bySubject.set(subject, years);
  }
  const subjects = Array.from(bySubject.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-3">
      {subjects.map(([subject, years]) => {
        const total = Array.from(years.values()).reduce((n, list) => n + list.length, 0);
        const yearEntries = Array.from(years.entries()).sort(([a], [b]) => {
          if (a === null) return 1;
          if (b === null) return -1;
          return b - a;
        });
        return (
          <Collapsible key={subject} className="rounded-2xl border-2 border-border bg-card">
            <CollapsibleTrigger className="tap-lg group flex w-full items-center justify-between gap-3 p-4 text-left">
              <span className="text-lg font-bold [overflow-wrap:anywhere]">{subject}</span>
              <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                {total}
                <ChevronDown className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 px-3 pb-3">
              {yearEntries.map(([year, list]) => (
                <Collapsible key={year ?? "none"} className="rounded-2xl border-2 border-border">
                  <CollapsibleTrigger className="tap-lg group flex w-full items-center justify-between gap-3 p-3 text-left">
                    <span className="font-semibold">{year ?? "Year not set"}</span>
                    <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                      {list.length}
                      <ChevronDown className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 px-3 pb-3">
                    {list.map((item) => (
                      <div key={getKey(item)}>{renderItem(item)}</div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
