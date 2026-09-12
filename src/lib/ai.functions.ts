import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-3.8-flash";

async function callAI(system: string, user: string): Promise<Record<string, unknown>> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured yet.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("The helper is busy right now. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits have run out. Please top up to keep using the helper.");
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return { raw: content };
  }
}

const TONE =
  "You support a teenage student with dyslexia and autism. Use short, calm, literal sentences. No idioms, no sarcasm, no long paragraphs, no emoji spam.";

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
      `${TONE} You are a Formula-Focused Coach marking against ${data.board || "the relevant"} exam board rubrics for ${data.subject}.
You judge ONLY: (1) the thinking logic, (2) the sequencing of steps, (3) whether the correct formulas, rules or techniques were named.
You completely ignore missing numerical working, missing final answers, missing essays, spelling and grammar. Never ask for calculations.
Reply as JSON with keys: score (0-100 integer for strategy quality), logic_feedback (2 short sentences), sequencing_feedback (2 short sentences), formula_feedback (2 short sentences naming the formulas/rules expected), missing_steps (array of short strings), struggle_tags (array of 1-4 short lowercase tags describing what she found hard), encouragement (one warm short sentence).`,
      `Question (${data.marks} marks):\n${data.questionText}\n\nHer step-by-step strategy:\n${data.strategy}`,
    );
    return {
      score: Number(out["score"] ?? 0),
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
