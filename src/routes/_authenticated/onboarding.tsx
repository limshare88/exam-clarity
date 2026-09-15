import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRefreshProfile } from "@/hooks/useProfile";
import { SUBJECTS, EXAM_BOARDS, LEARNING_PROFILES, CHILD_AVATARS } from "@/lib/subjects";
import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your profile — ExamPulse" },
      { name: "description", content: "Tell ExamPulse your subjects, exam boards and learning profile." },
      { property: "og:title", content: "Set up your profile — ExamPulse" },
      { property: "og:description", content: "Subjects, exam boards and comfort settings." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const refresh = useRefreshProfile();

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [boards, setBoards] = useState<Record<string, string>>({});
  const [needs, setNeeds] = useState<string[]>([]);
  const [mascot, setMascot] = useState<string>("mascot-chibi");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setAge(profile.age ? String(profile.age) : "");
    setNeeds(profile.learning_profile ?? []);
    if (profile.active_mascot && CHILD_AVATARS.some((a) => a.item_id === profile.active_mascot)) {
      setMascot(profile.active_mascot);
    }
    const map: Record<string, string> = {};
    (profile.subjects ?? []).forEach((s) => (map[s.subject] = s.board));
    setBoards(map);
  }, [profile]);

  function toggleSubject(subject: string, on: boolean) {
    setBoards((prev) => {
      const next = { ...prev };
      if (on) next[subject] = next[subject] ?? "";
      else delete next[subject];
      return next;
    });
  }

  async function save() {
    if (!name.trim()) { toast.error("Please add your name."); return; }
    const subjects = Object.entries(boards).map(([subject, board]) => ({ subject, board }));
    if (!subjects.length) { toast.error("Please pick at least one subject."); return; }
    if (subjects.some((s) => !s.board)) { toast.error("Pick an exam board for each subject."); return; }

    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("user_profiles")
      .update({
        name: name.trim(),
        age: age ? Number(age) : null,
        subjects,
        learning_profile: needs,
        active_mascot: mascot,
        onboarded: true,
      })
      .eq("user_id", auth.user!.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    refresh();
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Let's set you up 🌿</h1>
          <p className="mt-1 text-muted-foreground">
            Three short steps. You can change all of this later in Settings.
          </p>
        </header>

        <section className="surface-card space-y-4 p-6">
          <h2 className="text-xl font-bold">Choose your companion</h2>
          <p className="text-sm text-muted-foreground">
            You can unlock more companions later in the toy shop with Pulse Coins.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {CHILD_AVATARS.map((option) => (
              <button
                key={option.item_id}
                type="button"
                onClick={() => setMascot(option.item_id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition",
                  mascot === option.item_id ? "border-primary bg-primary/10 shadow-md" : "border-border bg-cream",
                )}
              >
                <Mascot character={option.item_id} className="h-40 rounded-xl border pointer-events-none" />
                <span className="text-base font-semibold">{option.item_name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="surface-card space-y-4 p-6">
          <h2 className="text-xl font-bold">1. About you</h2>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-base">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="tap-lg rounded-2xl border-2 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age" className="text-base">
              Age
            </Label>
            <Input
              id="age"
              type="number"
              min={5}
              max={100}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="tap-lg rounded-2xl border-2 text-base"
            />
          </div>
        </section>

        <section className="surface-card space-y-4 p-6">
          <h2 className="text-xl font-bold">2. Subjects and exam boards</h2>
          <p className="text-sm text-muted-foreground">
            Tick a subject, then choose the exam board for that subject only.
          </p>
          {SUBJECTS.map((subject) => {
            const checked = subject in boards;
            return (
              <div
                key={subject}
                className="rounded-2xl border-2 border-border bg-cream p-4"
              >
                <label className="flex min-h-14 items-center gap-4">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggleSubject(subject, Boolean(v))}
                    className="h-7 w-7 rounded-lg border-2"
                  />
                  <span className="text-lg font-semibold">{subject}</span>
                </label>
                {checked && (
                  <div className="mt-3">
                    <Select
                      value={boards[subject] ?? ""}
                      onValueChange={(v) => setBoards((p) => ({ ...p, [subject]: v }))}
                    >
                      <SelectTrigger className="tap-lg rounded-2xl border-2 bg-card text-base">
                        <SelectValue placeholder="Choose exam board" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXAM_BOARDS.map((b) => (
                          <SelectItem key={b} value={b} className="py-3 text-base">
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="surface-card space-y-3 p-6">
          <h2 className="text-xl font-bold">3. Learning profile</h2>
          <p className="text-sm text-muted-foreground">
            This tunes spacing, pacing and the tone of feedback. Tick anything that fits.
          </p>
          {LEARNING_PROFILES.map((item) => (
            <label
              key={item}
              className="flex min-h-16 items-center gap-4 rounded-2xl border-2 border-border bg-mint p-4"
            >
              <Checkbox
                checked={needs.includes(item)}
                onCheckedChange={(v) =>
                  setNeeds((prev) => (v ? [...prev, item] : prev.filter((n) => n !== item)))
                }
                className="h-7 w-7 rounded-lg border-2"
              />
              <span className="text-lg font-semibold">{item}</span>
            </label>
          ))}
        </section>

        <Button onClick={save} disabled={busy} className="tap-lg w-full rounded-2xl text-lg">
          Save and start
        </Button>
      </div>
    </div>
  );
}
