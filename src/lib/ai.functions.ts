import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
Return JSON with one key, questions, containing an array of objects with exactly: question_number, question_text, marks.

STEP 1 — LOCATE MARKERS. Scan the document for printed numbered problem markers only: "Question 1", "Q2", "3.", "4)", "1(a)", "2 (b) (ii)". A block of text qualifies ONLY if it starts at such a marker. Text with no numbered marker is NEVER a question.

STEP 2 — DELETE FRONT MATTER. Completely discard, and never merge into any question: cover pages, candidate/centre name boxes, exam guidelines, "Information for candidates", "Instructions to candidates", time allowed, materials required, safety instructions, calculator/equipment notices, formula sheets and data sheets, regulations, advice, contents pages, section headings, page numbers, running headers and footers, "Turn over", "End of questions", blank page notices, examiner-use tables, copyright and publisher lines.

STEP 3 — EXTRACT. For each surviving marker, output only the actual problem text a student must answer, starting at the marker's own wording (exclude the marker label itself from question_text). Keep subparts under their parent number. Preserve formulas, units, values, command words, options and diagram/table references. Invent nothing.

STEP 4 — MARKS. Read the printed allocation such as [4 marks], (3), (3 marks), [Total: 6]. Store the integer total; sum printed subpart marks. Use 1 only when no allocation is printed.

Reject any candidate that is an instruction, notice, heading, or general guidance even if a number appears near it. Return an empty questions array if no genuine numbered questions are visible.`,
      `Find every numbered problem marker in this ${data.subject} paper for ${data.board} and extract only those problems with their marks. Ignore all front matter and instructions. Output valid JSON only.`,
      { mimeType: data.mimeType, data: btoa(binary) },
    );

    const FLUFF =
      /^(instructions?|information|advice|guidance|materials|equipment|safety|read (these|the) |answer all|write your|time allowed|do not (write|turn)|use black|you may use|calculators?|formula|data sheet|contents|section [a-z]|turn over|end of|blank page|copyright|for examiner)/i;

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
      return [{ question_number: questionNumber, question_text: questionText, marks }];
    });
    if (!questions.length) throw new Error("No numbered exam questions were found in this file.");
    return { questions };
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

export const coachStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      questionText: string;
      subject: string;
      board: string;
      strategy: string;
      marks: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    const out = await callAI(
      `${TONE} You are a Formula-Focused Coach applying the official published marking conventions, command-word definitions, assessment objectives, and method-mark rules used by ${data.board || "the selected exam board"} for ${data.subject}.
Treat the named board as binding. Do not blend in conventions from another board. Interpret command words exactly as that board does. Allocate credit in proportion to this question's ${data.marks} available marks, including method, accuracy, independent, consequential, or equivalent marks where that board uses them.
You judge ONLY: (1) the thinking logic, (2) the sequencing of steps, (3) whether the correct formulas, rules or techniques were named.
SUBJECT RULE FOR THIS ANSWER: ${subjectStrategyRule(data.subject)} Treat that omission as fully expected and never deduct for it, never mention it as missing, and never ask her to supply it.
You completely ignore missing numerical working, missing final answers, missing paragraph descriptions, missing raw data calculations, missing essays, missing text transformations, spelling and grammar. Never ask for calculations.
Do not claim access to a live mark scheme. If the exact paper-specific scheme is unavailable, apply the named board's established public conventions conservatively.
Reply as JSON with keys: score (0-100 integer for strategy quality), board_used (the exact named board), rubric_basis (one concise sentence naming the board-specific command word or marking principle applied), logic_feedback (2 short sentences), sequencing_feedback (2 short sentences), formula_feedback (2 short sentences naming the formulas/rules expected), missing_steps (array of short strings), struggle_tags (array of 1-4 short lowercase tags describing what she found hard), encouragement (one warm short sentence).`,
      `Question (${data.marks} marks):\n${data.questionText}\n\nHer step-by-step strategy:\n${data.strategy}`,
    );
    return {
      score: Number(out["score"] ?? 0),
      board_used: String(out["board_used"] ?? data.board),
      rubric_basis: String(out["rubric_basis"] ?? `${data.board} command-word and method-mark conventions.`),
      logic_feedback: String(out["logic_feedback"] ?? ""),
      sequencing_feedback: String(out["sequencing_feedback"] ?? ""),
      formula_feedback: String(out["formula_feedback"] ?? ""),
      missing_steps: (out["missing_steps"] ?? []) as string[],
      struggle_tags: (out["struggle_tags"] ?? []) as string[],
      encouragement: String(out["encouragement"] ?? ""),
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
Reply as JSON with keys: question_text, marks (integer 2-6), targeted (array of short strings saying what this drill practises).`,
      `Struggle patterns: ${tags.length ? tags.join(", ") : "none recorded yet, use general exam command-word practice"}
Stumble-block vocabulary: ${vocab.length ? vocab.join(", ") : "none recorded yet"}`,
    );

    return {
      question_text: String(out["question_text"] ?? ""),
      marks: Number(out["marks"] ?? 3),
      targeted: (out["targeted"] ?? []) as string[],
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
