import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { subjectStrategyRule } from "@/lib/subjects";
import type { ExamSchematicData, SchematicKind } from "@/components/ExamSchematic";

const MODEL = "google/gemini-3.8-flash";

type MediaInput = { mimeType: string; data: string };

async function callAI(
  system: string,
  user: string,
  media?: MediaInput,
): Promise<Record<string, unknown>> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured yet.");

  const requestContent = media
    ? [
        { type: "text", text: user },
        ...(media.mimeType === "application/pdf"
          ? [{ type: "file", file: { filename: "exam-paper.pdf", file_data: `data:${media.mimeType};base64,${media.data}` } }]
          : [{ type: "image_url", image_url: { url: `data:${media.mimeType};base64,${media.data}` } }]),
      ]
    : user;

  let res: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: requestContent },
        ],
      }),
    });
    if (res.ok || (res.status !== 429 && res.status < 500)) break;
    const retryAfter = Number(res.headers.get("Retry-After") ?? 0);
    await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 800 * 2 ** attempt)));
  }

  if (!res) throw new Error("The AI helper could not start.");

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("The helper is busy right now. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits have run out. Please top up to keep using the helper.");
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const responseContent = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(responseContent) as Record<string, unknown>;
  } catch {
    return { raw: responseContent };
  }
}

const TONE =
  "You support a teenage student with dyslexia and autism. Use short, calm, literal sentences. No idioms, no sarcasm, no long paragraphs, no emoji spam.";

export type DiagramBox = { x: number; y: number; w: number; h: number };

/** One printed diagram, tied to a nearby sub-part by a verbatim quote from the question
 * text (not a structural label the AI would have to guess in our internal syntax — exam
 * papers are too inconsistently formatted for that to match reliably). `anchor` is a short
 * phrase copied word-for-word from question_text; matching it against each part's own
 * text (client-side, against the same parser that renders the page) finds where it goes. */
export type ExtractedDiagram = { anchor: string; box: DiagramBox };

export type ExtractedExamQuestion = {
  question_number: string;
  question_text: string;
  marks: number;
  page: number;
  diagrams: ExtractedDiagram[];
};

export const extractExamQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filePath: string; mimeType: string; subject: string; board: string }) => input)
  .handler(async ({ data, context }) => {
    if (!data.filePath.startsWith(`${context.userId}/`)) throw new Error("This upload does not belong to your account.");
    if (data.mimeType !== "application/pdf" && !data.mimeType.startsWith("image/")) {
      throw new Error("Upload a PDF or image file.");
    }

    const { data: file, error } = await context.supabase.storage.from("exam-uploads").download(data.filePath);
    if (error || !file) throw new Error(error?.message ?? "The uploaded file could not be read.");
    if (file.size === 0) throw new Error("The uploaded file is empty.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    }

    const out = await callAI(
      `You are a strict exam-paper extraction engine for ${data.board || "the selected exam board"} ${data.subject} papers.
Return JSON with keys: paper_type (string like "Paper 1" or "" if not printed), exam_year (4-digit integer or null), and questions — an array of objects with exactly: question_number, question_text, marks, page, diagrams.

STEP 1 — LOCATE MARKERS. Scan the document for printed numbered problem markers only: "Question 1", "Q2", "3.", "4)", "1(a)", "2 (b) (ii)". A block of text qualifies ONLY if it starts at such a marker. Text with no numbered marker is NEVER a question.

STEP 2 — DELETE FRONT MATTER. Completely discard, and never merge into any question: cover pages, candidate/centre name boxes, exam guidelines, "Information for candidates", "Instructions to candidates", time allowed, materials required, safety instructions, calculator/equipment notices, formula sheets and data sheets, regulations, advice, contents pages, section headings, page numbers, running headers and footers, "Turn over", "End of questions", blank page notices, examiner-use tables, copyright and publisher lines.

STEP 3 — EXTRACT. For each surviving marker, output only the actual problem text a student must answer, starting at the marker's own wording (exclude the marker label itself from question_text). Keep subparts under their parent number and keep each subpart's printed label, e.g. "(a) ... (b) ...", exactly where it appears so the text can be broken into blocks later. Preserve formulas, units, values, command words, options and diagram/table references. Invent nothing.

MULTIPLE CHOICE. When a question offers answer options (A, B, C, D, tick boxes, bubbles or "which of the following"), it is ONE question, never several. Keep the stem and every option inside a single question_text, each option on its own line written as "A. ...", "B. ...". Never turn options into separate questions and never relabel them as sub-parts.

STEP 4 — MARKS. Read the printed allocation such as [4 marks], (3), (3 marks), [Total: 6]. Store the integer total; sum printed subpart marks. Use 1 only when no allocation is printed.

STEP 5 — DIAGRAMS. A single question can have MORE THAN ONE printed diagram, chart, graph, table image, circuit, map or structural illustration — one per sub-part is common (e.g. an answer-options table next to part (a)(i), and a separate graph next to part (b)). Find every such visual printed with this question and list them ALL in "diagrams": an array of objects with exactly: anchor, x, y, w, h. "anchor" is a phrase of 6 to 15 words copied VERBATIM, word-for-word, from the question_text you are writing for this question — specifically from the sentence of the sub-part this diagram sits next to and illustrates. Every word in "anchor" must appear in question_text exactly as printed there; never paraphrase, shorten, or invent it, and never copy words that are not part of this question's own question_text. Use anchor "" only when a diagram belongs to the whole question's opening stem and is not next to any one specific lettered/numbered sub-part. x, y, w, h are the tight rectangle around that one visual, as fractions of the full page, {"x":0.12,"y":0.34,"w":0.55,"h":0.22} where x,y is the top-left corner — exclude surrounding body text from the box. Never merge two separate diagrams into one box. When there is no visual at all, diagrams must be an empty array.

STEP 6 — PAGE AND PAPER. Set page to the 1-based page number the question is printed on (use 1 for a single screenshot). Read paper_type and exam_year from the printed cover or running header when visible; otherwise "" and null.

Reject any candidate that is an instruction, notice, heading, or general guidance even if a number appears near it. Return an empty questions array if no genuine numbered questions are visible.`,
      `Find every numbered problem marker in this ${data.subject} paper for ${data.board}, extract only those problems with their marks, note the page and every diagram rectangle (there can be more than one per question), and report the paper type and exam year. Ignore all front matter and instructions. Output valid JSON only.`,
      { mimeType: data.mimeType, data: btoa(binary) },
    );

    const FLUFF =
      /^(instructions?|information|advice|guidance|materials|equipment|safety|read (these|the) |answer all|write your|time allowed|do not (write|turn)|use black|you may use|calculators?|formula|data sheet|contents|section [a-z]|turn over|end of|blank page|copyright|for examiner)/i;

    const frac = (value: unknown) => Math.min(1, Math.max(0, Number(value) || 0));

    // Shared by both the normal and salvage paths: cap count and anchor length, drop
    // implausible or page-sized rectangles. The anchor's actual presence in question_text
    // is verified client-side at render time (see practice.tsx) — this only bounds size.
    const readDiagrams = (value: unknown): ExtractedDiagram[] => {
      if (!Array.isArray(value)) return [];
      return value
        .flatMap((entry): ExtractedDiagram[] => {
          if (!entry || typeof entry !== "object") return [];
          const raw = entry as Record<string, unknown>;
          const anchor = String(raw["anchor"] ?? "").trim().slice(0, 200);
          const box = { x: frac(raw["x"]), y: frac(raw["y"]), w: frac(raw["w"]), h: frac(raw["h"]) };
          if (box.w <= 0.04 || box.h <= 0.03 || box.w * box.h >= 0.9) return [];
          return [{ anchor, box }];
        })
        .slice(0, 8);
    };

    const candidates = Array.isArray(out["questions"]) ? out["questions"] : [];
    const questions = candidates.flatMap((value): ExtractedExamQuestion[] => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>;
      const questionNumber = String(item["question_number"] ?? "").trim();
      const questionText = String(item["question_text"] ?? "").trim();
      const marks = Math.max(1, Math.min(100, Math.round(Number(item["marks"] ?? 1)) || 1));
      // Must carry a real numbered marker, e.g. 1, Q2, 3(a), 4 (b)(ii), 1.1, 5c(iv)
      if (!/^(q(uestion)?[\s.:-]*)?\d+[\s.)\]:-]*([a-z0-9(). )\]-]*)$/i.test(questionNumber)) return [];
      if (questionText.length < 8) return [];
      if (FLUFF.test(questionText)) return [];

      const page = Math.max(1, Math.round(Number(item["page"] ?? 1)) || 1);

      return [
        {
          question_number: questionNumber,
          question_text: questionText,
          marks,
          page,
          diagrams: readDiagrams(item["diagrams"]),
        },
      ];
    });
    if (!questions.length) {
      // The model saw questions but our marker check rejected every label: keep the
      // genuine-looking ones rather than failing the whole upload.
      const salvaged = candidates.flatMap((value, index): ExtractedExamQuestion[] => {
        if (!value || typeof value !== "object") return [];
        const item = value as Record<string, unknown>;
        const questionText = String(item["question_text"] ?? "").trim();
        if (questionText.length < 8 || FLUFF.test(questionText)) return [];
        return [
          {
            question_number: String(item["question_number"] ?? "").trim() || String(index + 1),
            question_text: questionText,
            marks: Math.max(1, Math.min(100, Math.round(Number(item["marks"] ?? 1)) || 1)),
            page: Math.max(1, Math.round(Number(item["page"] ?? 1)) || 1),
            diagrams: [],
          },
        ];
      });
      if (!salvaged.length) {
        throw new Error(
          "No numbered exam questions were found in this file. Check the pages contain printed question numbers and are not blurry.",
        );
      }
      questions.push(...salvaged);
    }


    const yearValue = Math.round(Number(out["exam_year"] ?? 0));
    return {
      questions,
      paper_type: String(out["paper_type"] ?? "").trim(),
      exam_year: yearValue >= 1990 && yearValue <= 2100 ? yearValue : null,
    };
  });

export const MARK_SCHEME_NAME_PATTERN =
  /(mark[\s_-]*scheme|marking[\s_-]*scheme|marking[\s_-]*criteria|markscheme|\bms\b|_ms[._-]|answer[\s_-]*key|examiner[\s_-]*report)/i;

export type MarkSchemeEntry = { question_number: string; answer_points: string[]; marks: number };

/** Reads an official marking scheme and links it to one subject, paper and year. */
export const extractMarkScheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      filePath: string;
      mimeType: string;
      subject: string;
      board: string;
      fileName: string;
      paperType?: string | undefined;
      examYear?: number | null | undefined;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    if (!data.filePath.startsWith(`${context.userId}/`)) throw new Error("This upload does not belong to your account.");
    if (data.mimeType !== "application/pdf" && !data.mimeType.startsWith("image/")) {
      throw new Error("Upload a PDF or image file.");
    }

    const { data: file, error } = await context.supabase.storage.from("exam-uploads").download(data.filePath);
    if (error || !file) throw new Error(error?.message ?? "The uploaded file could not be read.");
    if (file.size === 0) throw new Error("The uploaded file is empty.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    }

    const out = await callAI(
      `You read official ${data.board || "exam board"} ${data.subject} MARKING SCHEMES (also called mark schemes, MS, marking criteria or answer keys).
This document is an answer guide, not a question paper. Do NOT require printed question body text and do NOT reject the document because it has no full questions.
Return JSON with keys:
- is_mark_scheme (true when the document is a marking scheme, answer key or marking criteria; false when it is a plain question paper)
- paper_type (string such as "Paper 1", or "" when not printed)
- exam_year (4-digit integer or null)
- scheme_text (a clean plain-text transcription of the whole marking guidance, keeping question labels, accepted answers, method marks, and any generic marking principles, in reading order)
- entries (array of objects with exactly: question_number (the printed label, e.g. "1", "2(a)", "3(b)(ii)"), answer_points (array of short strings — the accepted answer points, method marks, working steps or credit criteria for that label), marks (integer total for that label, 1 when not printed))
Transcribe faithfully. Invent nothing. Keep formulas, units and command-word conventions exactly as printed.`,
      `Transcribe this ${data.subject} document for ${data.board || "the exam board"}. Decide whether it is a marking scheme, then map every marking entry to its question label. Output valid JSON only.`,
      { mimeType: data.mimeType, data: btoa(binary) },
    );

    const schemeText = String(out["scheme_text"] ?? "").trim();
    const rawEntries = Array.isArray(out["entries"]) ? out["entries"] : [];
    const entries: MarkSchemeEntry[] = rawEntries.flatMap((value): MarkSchemeEntry[] => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>;
      const points = (Array.isArray(item["answer_points"]) ? item["answer_points"] : [])
        .map((point) => String(point).trim())
        .filter(Boolean);
      if (!points.length) return [];
      return [
        {
          question_number: String(item["question_number"] ?? "").trim(),
          answer_points: points,
          marks: Math.max(1, Math.min(100, Math.round(Number(item["marks"] ?? 1)) || 1)),
        },
      ];
    });

    // Metadata keyword check plus the model's own content check.
    const detected =
      out["is_mark_scheme"] === true ||
      MARK_SCHEME_NAME_PATTERN.test(data.fileName) ||
      MARK_SCHEME_NAME_PATTERN.test(schemeText.slice(0, 2000));

    if (!detected) {
      return { detected: false as const, paper_type: "", exam_year: null, scheme_text: "", entries: [] };
    }
    if (!schemeText && !entries.length) throw new Error("This marking scheme could not be read. Try a clearer file.");

    const yearValue = Math.round(Number(out["exam_year"] ?? 0));
    const paperType = (data.paperType ?? "").trim() || String(out["paper_type"] ?? "").trim();
    const examYear =
      data.examYear ?? (yearValue >= 1990 && yearValue <= 2100 ? yearValue : null);

    const { error: saveError } = await context.supabase
      .from("mark_schemes")
      .upsert(
        {
          user_id: context.userId,
          subject: data.subject,
          board: data.board || null,
          paper_type: paperType || null,
          exam_year: examYear,
          file_path: data.filePath,
          original_name: data.fileName,
          scheme_text: schemeText.slice(0, 200000),
          entries,
          metadata: { extracted_by_ai: true, entry_count: entries.length },
        },
        { onConflict: "user_id,subject,paper_type,exam_year" },
      );
    // Unique index uses COALESCE, so fall back to a manual replace when upsert cannot match it.
    if (saveError) {
      await context.supabase
        .from("mark_schemes")
        .delete()
        .eq("user_id", context.userId)
        .eq("subject", data.subject)
        .eq("paper_type", paperType || "")
        .eq("exam_year", examYear ?? 0);
      const { error: insertError } = await context.supabase.from("mark_schemes").insert({
        user_id: context.userId,
        subject: data.subject,
        board: data.board || null,
        paper_type: paperType || null,
        exam_year: examYear,
        file_path: data.filePath,
        original_name: data.fileName,
        scheme_text: schemeText.slice(0, 200000),
        entries,
        metadata: { extracted_by_ai: true, entry_count: entries.length },
      });
      if (insertError) throw new Error(insertError.message);
    }

    return {
      detected: true as const,
      paper_type: paperType,
      exam_year: examYear,
      scheme_text: schemeText,
      entries,
    };
  });


export const deconstructQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { questionText: string; subject: string }) => input)
  .handler(async ({ data }) => {
    const out = await callAI(
      `${TONE} You break dense exam questions into three clean blocks. Reply as JSON with keys: core_goal (one short sentence), command_words (array of {word, meaning}), facts (array of short strings holding given data, values, units or key details).`,
      `Subject: ${data.subject}\nExam question:\n${data.questionText}`,
    );
    return {
      core_goal: String(out["core_goal"] ?? ""),
      command_words: (out["command_words"] ?? []) as Array<{ word: string; meaning: string }>,
      facts: (out["facts"] ?? []) as string[],
    };
  });

export const lookupWord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { word: string; subject: string; sentence: string }) => input)
  .handler(async ({ data, context }) => {
    const out = await callAI(
      `${TONE} You explain one word at a time. Reply as JSON with keys: definition (simple, max 20 words), everyday_example (one everyday sentence), subject_context (how the word is used specifically in the named exam subject, and how that differs from everyday use).`,
      `Word: "${data.word}"\nSubject: ${data.subject}\nSentence it appeared in: ${data.sentence}`,
    );

    const record = {
      definition: String(out["definition"] ?? ""),
      everyday_example: String(out["everyday_example"] ?? ""),
      subject_context: String(out["subject_context"] ?? ""),
    };

    const { supabase, userId } = context;
    const clean = data.word.toLowerCase();
    const { data: existing } = await supabase
      .from("vocab_stumble_blocks")
      .select("id, click_count")
      .eq("user_id", userId)
      .eq("word", clean)
      .eq("subject", data.subject)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("vocab_stumble_blocks")
        .update({ click_count: (existing.click_count ?? 1) + 1, ...record })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("vocab_stumble_blocks")
        .insert({ user_id: userId, word: clean, subject: data.subject, ...record });
    }

    return record;
  });

export type CoachPartFeedback = {
  label: string;
  score: number;
  logic_feedback: string;
  sequencing_feedback: string;
  formula_feedback: string;
  missing_steps: string[];
};

export const coachStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      questionText: string;
      subject: string;
      board: string;
      strategy: string;
      marks: number;
      questionId?: string | null;
      paperType?: string | null;
      examYear?: number | null | undefined;
      questionNumber?: string | null;
      parts?: { label: string; question_text: string; strategy: string }[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const parts = (data.parts ?? []).filter((p) => p.question_text.trim().length > 0);
    const multi = parts.length > 1;

    // STEP 1 — read the saved question row so the paper identity comes from the bank,
    // not only from what the screen passed in.
    let subject = data.subject;
    let board = data.board;
    let paperType = data.paperType ?? null;
    let examYear = data.examYear ?? null;
    let questionNumber = (data.questionNumber ?? "").trim();
    if (data.questionId) {
      const { data: row } = await context.supabase
        .from("exam_questions")
        .select("subject, board, paper_type, exam_year, metadata")
        .eq("id", data.questionId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (row) {
        subject = row.subject || subject;
        board = row.board || board;
        paperType = row.paper_type ?? paperType;
        examYear = row.exam_year ?? examYear;
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        questionNumber = String(meta["question_number"] ?? questionNumber).trim();
      }
    }

    // STEP 2 — find the marking scheme linked to this exact subject / paper / year.
    // Fall back to the same subject's scheme only when no exact paper match exists.
    let schemeBrief = "";
    {
      const { data: schemes } = await context.supabase
        .from("mark_schemes")
        .select("scheme_text, entries, paper_type, exam_year, original_name")
        .eq("user_id", context.userId)
        .eq("subject", subject)
        .order("updated_at", { ascending: false })
        .limit(25);

      const list = schemes ?? [];
      const scheme =
        list.find((s) => (!paperType || s.paper_type === paperType) && (!examYear || s.exam_year === examYear)) ??
        list.find((s) => (paperType && s.paper_type === paperType) || (examYear && s.exam_year === examYear)) ??
        list[0];

      if (scheme) {
        const entries = (Array.isArray(scheme.entries) ? scheme.entries : []) as MarkSchemeEntry[];
        const stem = (questionNumber.match(/\d+/)?.[0] ?? "").toLowerCase();
        const relevant = stem
          ? entries.filter((entry) => (String(entry.question_number ?? "").match(/\d+/)?.[0] ?? "") === stem)
          : [];
        const chosen = relevant.length ? relevant : entries;
        const lines = chosen
          .slice(0, 24)
          .map((entry) => `${entry.question_number} (${entry.marks} marks): ${entry.answer_points.join(" | ")}`)
          .join("\n");
        const exact = (!paperType || scheme.paper_type === paperType) && (!examYear || scheme.exam_year === examYear);
        schemeBrief = `\n\nOFFICIAL MARKING SCHEME${exact ? " for this exact paper" : " for this subject (closest match)"} (${scheme.original_name ?? "uploaded scheme"}${scheme.paper_type ? `, ${scheme.paper_type}` : ""}${scheme.exam_year ? `, ${scheme.exam_year}` : ""})${relevant.length ? ` — marking points for question ${questionNumber}` : ""}:\n${lines || String(scheme.scheme_text ?? "").slice(0, 4000)}`;
      }
    }


    const partsBrief = multi
      ? parts
          .map(
            (p) =>
              `SUB-QUESTION ${p.label || "(main)"}:\n${p.question_text}\nHer strategy for ${p.label || "this part"}:\n${p.strategy.trim() || "(left blank)"}`,
          )
          .join("\n\n")
      : `Question (${data.marks} marks):\n${data.questionText}\n\nHer step-by-step strategy:\n${data.strategy}`;

    const out = await callAI(
      `${TONE} You are a Formula-Focused Coach applying the official published marking conventions, command-word definitions, assessment objectives, and method-mark rules used by ${board || "the selected exam board"} for ${subject}.
Treat the named board as binding. Do not blend in conventions from another board. Interpret command words exactly as that board does. Allocate credit in proportion to this question's ${data.marks} available marks, including method, accuracy, independent, consequential, or equivalent marks where that board uses them.
You judge ONLY: (1) the thinking logic, (2) the sequencing of steps, (3) whether the correct formulas, rules or techniques were named.
SUBJECT RULE FOR THIS ANSWER: ${subjectStrategyRule(subject)} Treat that omission as fully expected and never deduct for it, never mention it as missing, and never ask her to supply it.
You completely ignore missing numerical working, missing final answers, missing paragraph descriptions, missing raw data calculations, missing essays, missing text transformations, spelling and grammar. Never ask for calculations.
${
  schemeBrief
    ? `MANDATORY MARK SCHEME CALIBRATION. The official uploaded marking scheme for this paper is supplied at the end of the user message. It overrides your own expectations.
Before scoring, list to yourself the explicit marking points, threshold expectations and approved keywords it gives for this question. Then:
- Credit a strategy step only when it would genuinely reach one of those marking points.
- Score in proportion to how many of the scheme's marking points her plan would secure out of ${data.marks}.
- In formula_feedback name the exact rules, formulas or approved keywords the scheme requires.
- In missing_steps name the specific scheme marking points her plan would miss, in the scheme's own wording, simplified into short calm phrases.
Never contradict the scheme and never invent marking points it does not contain.`
    : "Do not claim access to a live mark scheme. If the exact paper-specific scheme is unavailable, apply the named board's established public conventions conservatively."
}

${
  multi
    ? `This question has ${parts.length} separate sub-questions and she wrote a separate blueprint for each. Grade EVERY sub-question independently on its own merits: never let one part's quality change another part's judgement, and never merge them. A blank part scores 0 with a calm prompt about what its first step should have been.
Reply as JSON with keys: part_feedback (array, one object per sub-question in the same order, each with label (copy the given label exactly), score (0-100 integer), logic_feedback (2 short sentences), sequencing_feedback (2 short sentences), formula_feedback (2 short sentences naming the formulas/rules expected for THAT part), missing_steps (array of short strings)), score (0-100 integer overall, the average across the parts), board_used, rubric_basis (one concise sentence naming the board-specific command word or marking principle applied), struggle_tags (array of 1-4 short lowercase tags), encouragement (one warm short sentence about the whole question).`
    : `Reply as JSON with keys: score (0-100 integer for strategy quality), board_used (the exact named board), rubric_basis (one concise sentence naming the board-specific command word or marking principle applied), logic_feedback (2 short sentences), sequencing_feedback (2 short sentences), formula_feedback (2 short sentences naming the formulas/rules expected), missing_steps (array of short strings), struggle_tags (array of 1-4 short lowercase tags describing what she found hard), encouragement (one warm short sentence).`
}`,
      (multi
        ? `Whole question (${data.marks} marks total):\n${data.questionText}\n\n${partsBrief}`
        : partsBrief) + schemeBrief,

    );

    const rawParts = Array.isArray(out["part_feedback"]) ? out["part_feedback"] : [];
    const part_feedback: CoachPartFeedback[] = rawParts.flatMap((value, index): CoachPartFeedback[] => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>;
      return [
        {
          label: String(item["label"] ?? parts[index]?.label ?? ""),
          score: Number(item["score"] ?? 0),
          logic_feedback: String(item["logic_feedback"] ?? ""),
          sequencing_feedback: String(item["sequencing_feedback"] ?? ""),
          formula_feedback: String(item["formula_feedback"] ?? ""),
          missing_steps: (item["missing_steps"] ?? []) as string[],
        },
      ];
    });

    const overall = Number(out["score"] ?? 0);
    const averaged =
      part_feedback.length && !overall
        ? Math.round(part_feedback.reduce((sum, p) => sum + p.score, 0) / part_feedback.length)
        : overall;

    return {
      score: averaged,
      board_used: String(out["board_used"] ?? board),
      rubric_basis: String(out["rubric_basis"] ?? `${data.board} command-word and method-mark conventions.`),
      logic_feedback: String(out["logic_feedback"] ?? ""),
      sequencing_feedback: String(out["sequencing_feedback"] ?? ""),
      formula_feedback: String(out["formula_feedback"] ?? ""),
      missing_steps: (out["missing_steps"] ?? []) as string[],
      struggle_tags: (out["struggle_tags"] ?? []) as string[],
      encouragement: String(out["encouragement"] ?? ""),
      part_feedback,
    };
  });


export const generateReinforceQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subject: string; board: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: logs } = await supabase
      .from("session_logs")
      .select("struggle_tags, score, subject")
      .eq("user_id", userId)
      .eq("subject", data.subject)
      .order("created_at", { ascending: false })
      .limit(25);

    const { data: words } = await supabase
      .from("vocab_stumble_blocks")
      .select("word, click_count")
      .eq("user_id", userId)
      .eq("subject", data.subject)
      .eq("mastered", false)
      .order("click_count", { ascending: false })
      .limit(12);

    const tags = Array.from(new Set((logs ?? []).flatMap((l) => l.struggle_tags ?? []))).slice(0, 8);
    const vocab = (words ?? []).map((w) => w.word);

    const out = await callAI(
      `${TONE} You write ONE fresh practice exam question in the style of ${data.board || "a major"} exam board for ${data.subject}.

STRICT SUBJECT ISOLATION — this is the highest priority rule.
The ONLY subject is ${data.subject}. Every concept, keyword, scenario, term, formula, unit and symbol must come from the ${data.board || "official"} ${data.subject} syllabus alone.
It is completely forbidden to mention, borrow or blend content from any other subject. For example: no Physics ideas, symbols (λ, v, f, F=ma) or equations inside a Biology or Chemistry question; no Chemistry reactions inside a Mathematics question; no Biology processes inside a Physics question.
Use the exact, pure terminology and command words an official ${data.board || "exam board"} examiner would print on a ${data.subject} paper — no invented hybrid wording.
Before replying, re-read your own question and delete anything that belongs to another subject. If a struggle pattern or vocabulary word below belongs to another subject, ignore it completely rather than forcing it in.

Target her known struggle patterns and reuse her stumble-block vocabulary naturally inside the question, but ONLY where they genuinely belong to ${data.subject}.
The question must be answerable by describing a strategy (no long calculation required).
When a visual materially supports the question, include an exam schematic. Use only the diagram kinds allowed for the named subject:
- Physics: force, circuit, wave, rays.
- Chemistry: apparatus, bonding.
- Biology: plant_cell, cell_division, organ.
- Mathematics: function_graph, integration_area, trig_graph, geometry, circle_theorem.
Never use a diagram kind from another subject's list.
The renderer enforces crisp monochrome vectors on a clear background. Keep labels short, literal, widely readable, and essential only. Never request decorative images or colour. The kind value MUST be exactly one token from the subject's list above; do not invent synonyms such as free_body_diagram.
For function_graph variant use quadratic, cubic, or exponential. For trig_graph use sin, cos, or tan. For apparatus use test_tube, beaker, or distillation. For other kinds use a short descriptive variant.
Reply as JSON with keys: question_text, marks (integer 2-6), subject_used (must be exactly "${data.subject}"), targeted (array of short strings), and schematic. schematic must be null when no diagram is needed, otherwise an object with exactly: kind, title, labels (0-4 short strings), variant, values (0-6 finite numbers). The question text must explicitly refer to the schematic when supplied.`,
      `Subject (the only allowed subject): ${data.subject}
Exam board: ${data.board || "major UK board"}
Struggle patterns recorded in ${data.subject}: ${tags.length ? tags.join(", ") : "none recorded yet, use general exam command-word practice"}
Stumble-block vocabulary from ${data.subject}: ${vocab.length ? vocab.join(", ") : "none recorded yet"}`,
    );


    const allowedBySubject: Record<string, SchematicKind[]> = {
      mathematics: ["function_graph", "integration_area", "trig_graph", "geometry", "circle_theorem"],
      physics: ["force", "circuit", "wave", "rays"],
      chemistry: ["apparatus", "bonding"],
      biology: ["plant_cell", "cell_division", "organ"],
    };
    const subjectKey = data.subject.toLowerCase();
    const allowed = Object.entries(allowedBySubject).find(([key]) => subjectKey.includes(key))?.[1] ?? [];
    const rawSchematic = out["schematic"];
    let schematic: ExamSchematicData | null = null;
    if (rawSchematic && typeof rawSchematic === "object") {
      const value = rawSchematic as Record<string, unknown>;
      const rawKind = String(value["kind"] ?? "").toLowerCase();
      const kindAliases: Record<string, SchematicKind> = {
        free_body_diagram: "force",
        force_diagram: "force",
        electrical_circuit: "circuit",
        circuit_diagram: "circuit",
        wave_cycle: "wave",
        ray_diagram: "rays",
        light_rays: "rays",
        lab_apparatus: "apparatus",
        distillation: "apparatus",
        dot_and_cross: "bonding",
        dot_cross: "bonding",
        cell: "plant_cell",
        mitosis: "cell_division",
        organ_vector: "organ",
        coordinate_curve: "function_graph",
        graph: "function_graph",
        area_under_curve: "integration_area",
        trigonometry_graph: "trig_graph",
        circle: "circle_theorem",
      };
      const kind = (kindAliases[rawKind] ?? rawKind) as SchematicKind;
      if (allowed.includes(kind)) {
        schematic = {
          kind,
          title: String(value["title"] ?? `${data.subject} exam schematic`).slice(0, 80),
          labels: (Array.isArray(value["labels"]) ? value["labels"] : []).slice(0, 4).map((item) => String(item).slice(0, 24)),
          variant: String(value["variant"] ?? "standard").slice(0, 30),
          values: (Array.isArray(value["values"]) ? value["values"] : []).slice(0, 6).map(Number).filter(Number.isFinite),
        };
      }
    }

    return {
      question_text: String(out["question_text"] ?? ""),
      marks: Number(out["marks"] ?? 3),
      targeted: (out["targeted"] ?? []) as string[],
      schematic,
      based_on: { tags, vocab },
    };
  });

export const summariseStumbleBlocks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: words } = await supabase
      .from("vocab_stumble_blocks")
      .select("word, subject, click_count")
      .eq("user_id", userId)
      .order("click_count", { ascending: false })
      .limit(25);
    const { data: logs } = await supabase
      .from("session_logs")
      .select("struggle_tags, score")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!words?.length && !logs?.length) {
      return { summary: "No practice yet. Finish a few questions and a summary will appear here." };
    }

    const out = await callAI(
      `${TONE} Write a short, kind summary (max 4 short sentences) of the concepts, command words and technical vocabulary this student currently finds hardest. Reply as JSON with key: summary.`,
      `Clicked words: ${(words ?? []).map((w) => `${w.word} (${w.subject} x${w.click_count})`).join(", ") || "none"}
Struggle tags from marked strategies: ${(logs ?? []).flatMap((l) => l.struggle_tags ?? []).join(", ") || "none"}
Recent strategy scores: ${(logs ?? []).map((l) => l.score).filter(Boolean).join(", ") || "none"}`,
    );
    return { summary: String(out["summary"] ?? "") };
  });
