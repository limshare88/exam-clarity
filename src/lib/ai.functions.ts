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

export type ExtractedExamQuestion = {
  question_number: string;
  question_text: string;
  marks: number;
  page: number;
  has_diagram: boolean;
  diagram_box: { x: number; y: number; w: number; h: number } | null;
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
Return JSON with keys: paper_type (string like "Paper 1" or "" if not printed), exam_year (4-digit integer or null), and questions — an array of objects with exactly: question_number, question_text, marks, page, has_diagram, diagram_box.

STEP 1 — LOCATE MARKERS. Scan the document for printed numbered problem markers only: "Question 1", "Q2", "3.", "4)", "1(a)", "2 (b) (ii)". A block of text qualifies ONLY if it starts at such a marker. Text with no numbered marker is NEVER a question.

STEP 2 — DELETE FRONT MATTER. Completely discard, and never merge into any question: cover pages, candidate/centre name boxes, exam guidelines, "Information for candidates", "Instructions to candidates", time allowed, materials required, safety instructions, calculator/equipment notices, formula sheets and data sheets, regulations, advice, contents pages, section headings, page numbers, running headers and footers, "Turn over", "End of questions", blank page notices, examiner-use tables, copyright and publisher lines.

STEP 3 — EXTRACT. For each surviving marker, output only the actual problem text a student must answer, starting at the marker's own wording (exclude the marker label itself from question_text). Keep subparts under their parent number and keep each subpart's printed label, e.g. "(a) ... (b) ...", exactly where it appears so the text can be broken into blocks later. Preserve formulas, units, values, command words, options and diagram/table references. Invent nothing.

STEP 4 — MARKS. Read the printed allocation such as [4 marks], (3), (3 marks), [Total: 6]. Store the integer total; sum printed subpart marks. Use 1 only when no allocation is printed.

STEP 5 — DIAGRAMS. Decide whether the question has its own diagram, chart, graph, table image, circuit, map or structural illustration printed with it. Set has_diagram true only then. When true, set diagram_box to the tight rectangle around that visual as fractions of the full page: {"x":0.12,"y":0.34,"w":0.55,"h":0.22} where x,y is the top-left corner. Exclude surrounding body text from the box. When there is no visual, set has_diagram false and diagram_box null.

STEP 6 — PAGE AND PAPER. Set page to the 1-based page number the question is printed on (use 1 for a single screenshot). Read paper_type and exam_year from the printed cover or running header when visible; otherwise "" and null.

Reject any candidate that is an instruction, notice, heading, or general guidance even if a number appears near it. Return an empty questions array if no genuine numbered questions are visible.`,
      `Find every numbered problem marker in this ${data.subject} paper for ${data.board}, extract only those problems with their marks, note the page and any diagram rectangle, and report the paper type and exam year. Ignore all front matter and instructions. Output valid JSON only.`,
      { mimeType: data.mimeType, data: btoa(binary) },
    );

    const FLUFF =
      /^(instructions?|information|advice|guidance|materials|equipment|safety|read (these|the) |answer all|write your|time allowed|do not (write|turn)|use black|you may use|calculators?|formula|data sheet|contents|section [a-z]|turn over|end of|blank page|copyright|for examiner)/i;

    const frac = (value: unknown) => Math.min(1, Math.max(0, Number(value) || 0));

    const candidates = Array.isArray(out["questions"]) ? out["questions"] : [];
    const questions = candidates.flatMap((value): ExtractedExamQuestion[] => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>;
      const questionNumber = String(item["question_number"] ?? "").trim();
      const questionText = String(item["question_text"] ?? "").trim();
      const marks = Math.max(1, Math.min(100, Math.round(Number(item["marks"] ?? 1)) || 1));
      // Must carry a real numbered marker, e.g. 1, Q2, 3(a), 4 (b)(ii)
      if (!/^(q(uestion)?\s*)?\d+\s*(\(?[a-z]\)?)?\s*(\(?(i|ii|iii|iv|v|vi)\)?)?\s*[.)]?$/i.test(questionNumber)) return [];
      if (questionText.length < 12) return [];
      if (FLUFF.test(questionText)) return [];

      const page = Math.max(1, Math.round(Number(item["page"] ?? 1)) || 1);
      const rawBox = item["diagram_box"] as Record<string, unknown> | null | undefined;
      let box: ExtractedExamQuestion["diagram_box"] = null;
      if (item["has_diagram"] === true && rawBox && typeof rawBox === "object") {
        const candidate = { x: frac(rawBox["x"]), y: frac(rawBox["y"]), w: frac(rawBox["w"]), h: frac(rawBox["h"]) };
        // Ignore implausible or page-sized rectangles.
        if (candidate.w > 0.04 && candidate.h > 0.03 && candidate.w * candidate.h < 0.9) box = candidate;
      }

      return [
        {
          question_number: questionNumber,
          question_text: questionText,
          marks,
          page,
          has_diagram: box !== null,
          diagram_box: box,
        },
      ];
    });
    if (!questions.length) throw new Error("No numbered exam questions were found in this file.");

    const yearValue = Math.round(Number(out["exam_year"] ?? 0));
    return {
      questions,
      paper_type: String(out["paper_type"] ?? "").trim(),
      exam_year: yearValue >= 1990 && yearValue <= 2100 ? yearValue : null,
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
      parts?: { label: string; question_text: string; strategy: string }[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const parts = (data.parts ?? []).filter((p) => p.question_text.trim().length > 0);
    const multi = parts.length > 1;

    const partsBrief = multi
      ? parts
          .map(
            (p) =>
              `SUB-QUESTION ${p.label || "(main)"}:\n${p.question_text}\nHer strategy for ${p.label || "this part"}:\n${p.strategy.trim() || "(left blank)"}`,
          )
          .join("\n\n")
      : `Question (${data.marks} marks):\n${data.questionText}\n\nHer step-by-step strategy:\n${data.strategy}`;

    const out = await callAI(
      `${TONE} You are a Formula-Focused Coach applying the official published marking conventions, command-word definitions, assessment objectives, and method-mark rules used by ${data.board || "the selected exam board"} for ${data.subject}.
Treat the named board as binding. Do not blend in conventions from another board. Interpret command words exactly as that board does. Allocate credit in proportion to this question's ${data.marks} available marks, including method, accuracy, independent, consequential, or equivalent marks where that board uses them.
You judge ONLY: (1) the thinking logic, (2) the sequencing of steps, (3) whether the correct formulas, rules or techniques were named.
SUBJECT RULE FOR THIS ANSWER: ${subjectStrategyRule(data.subject)} Treat that omission as fully expected and never deduct for it, never mention it as missing, and never ask her to supply it.
You completely ignore missing numerical working, missing final answers, missing paragraph descriptions, missing raw data calculations, missing essays, missing text transformations, spelling and grammar. Never ask for calculations.
Do not claim access to a live mark scheme. If the exact paper-specific scheme is unavailable, apply the named board's established public conventions conservatively.
${
  multi
    ? `This question has ${parts.length} separate sub-questions and she wrote a separate blueprint for each. Grade EVERY sub-question independently on its own merits: never let one part's quality change another part's judgement, and never merge them. A blank part scores 0 with a calm prompt about what its first step should have been.
Reply as JSON with keys: part_feedback (array, one object per sub-question in the same order, each with label (copy the given label exactly), score (0-100 integer), logic_feedback (2 short sentences), sequencing_feedback (2 short sentences), formula_feedback (2 short sentences naming the formulas/rules expected for THAT part), missing_steps (array of short strings)), score (0-100 integer overall, the average across the parts), board_used, rubric_basis (one concise sentence naming the board-specific command word or marking principle applied), struggle_tags (array of 1-4 short lowercase tags), encouragement (one warm short sentence about the whole question).`
    : `Reply as JSON with keys: score (0-100 integer for strategy quality), board_used (the exact named board), rubric_basis (one concise sentence naming the board-specific command word or marking principle applied), logic_feedback (2 short sentences), sequencing_feedback (2 short sentences), formula_feedback (2 short sentences naming the formulas/rules expected), missing_steps (array of short strings), struggle_tags (array of 1-4 short lowercase tags describing what she found hard), encouragement (one warm short sentence).`
}`,
      multi
        ? `Whole question (${data.marks} marks total):\n${data.questionText}\n\n${partsBrief}`
        : partsBrief,
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
      board_used: String(out["board_used"] ?? data.board),
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
      .order("created_at", { ascending: false })
      .limit(25);

    const { data: words } = await supabase
      .from("vocab_stumble_blocks")
      .select("word, click_count")
      .eq("user_id", userId)
      .eq("mastered", false)
      .order("click_count", { ascending: false })
      .limit(12);

    const tags = Array.from(new Set((logs ?? []).flatMap((l) => l.struggle_tags ?? []))).slice(0, 8);
    const vocab = (words ?? []).map((w) => w.word);

    const out = await callAI(
      `${TONE} You write ONE fresh practice exam question in the style of ${data.board || "a major"} exam board for ${data.subject}.
Target her known struggle patterns and reuse her stumble-block vocabulary naturally inside the question.
The question must be answerable by describing a strategy (no long calculation required).
When a visual materially supports the question, include an exam schematic. Use only the diagram kinds allowed for the named subject:
- Physics: force, circuit, wave, rays.
- Chemistry: apparatus, bonding.
- Biology: plant_cell, cell_division, organ.
- Mathematics: function_graph, integration_area, trig_graph, geometry, circle_theorem.
The renderer enforces crisp monochrome vectors on a clear background. Keep labels short, literal, widely readable, and essential only. Never request decorative images or colour.
For function_graph variant use quadratic, cubic, or exponential. For trig_graph use sin, cos, or tan. For apparatus use test_tube, beaker, or distillation. For other kinds use a short descriptive variant.
Reply as JSON with keys: question_text, marks (integer 2-6), targeted (array of short strings), and schematic. schematic must be null when no diagram is needed, otherwise an object with exactly: kind, title, labels (0-4 short strings), variant, values (0-6 finite numbers). The question text must explicitly refer to the schematic when supplied.`,
      `Struggle patterns: ${tags.length ? tags.join(", ") : "none recorded yet, use general exam command-word practice"}
Stumble-block vocabulary: ${vocab.length ? vocab.join(", ") : "none recorded yet"}`,
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
