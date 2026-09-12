import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRefreshProfile } from "@/hooks/useProfile";
import { AppShell } from "@/components/AppShell";
import { TIMER_OPTIONS } from "@/lib/subjects";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ExamPulse" },
      { name: "description", content: "Choose your challenge timer, review your subjects and sign out." },
      { property: "og:title", content: "Settings — ExamPulse" },
      { property: "og:description", content: "Timer length, subjects and account options." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: profile } = useProfile();
  const refresh = useRefreshProfile();
  const navigate = useNavigate();
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    if (profile) setTimer(profile.timer_seconds);
  }, [profile]);

  async function saveTimer(value: number) {
    setTimer(value);
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("user_profiles").update({ timer_seconds: value }).eq("user_id", auth.user!.id);
    refresh();
    toast.success("Challenge timer updated");
  }

  return (
    <AppShell title="Settings" subtitle="Make it comfortable for you">
      <section className="surface-card space-y-4 p-6">
        <h2 className="text-xl font-bold">⏱️ Challenge timer</h2>
        <p className="text-sm text-muted-foreground">Used in Challenge Mode. No loud alarms, ever.</p>
        <div className="grid grid-cols-2 gap-3">
          {TIMER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => saveTimer(opt.value)}
              className={`tap-lg rounded-2xl border-2 border-border px-4 font-semibold transition-colors ${
                timer === opt.value ? "bg-primary text-primary-foreground" : "bg-cream"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="surface-card space-y-3 p-6">
        <h2 className="text-xl font-bold">📚 Your subjects</h2>
        {(profile?.subjects ?? []).map((s) => (
          <div
            key={s.subject}
            className="flex items-center justify-between rounded-2xl border-2 border-border bg-lavender p-4"
          >
            <span className="font-semibold">{s.subject}</span>
            <span className="text-sm">{s.board}</span>
          </div>
        ))}
        <Link to="/onboarding">
          <Button variant="secondary" className="tap-lg mt-2 w-full rounded-2xl border-2 border-border">
            Edit profile and subjects
          </Button>
        </Link>
      </section>

      <section className="surface-card space-y-3 p-6">
        <h2 className="text-xl font-bold">🧠 Learning profile</h2>
        <p className="reading-text text-base">
          {profile?.learning_profile?.length
            ? profile.learning_profile.join(", ")
            : "Nothing selected yet."}
        </p>
      </section>

      <Button
        variant="secondary"
        className="tap-lg w-full rounded-2xl border-2 border-border"
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/" });
        }}
      >
        Sign out
      </Button>
    </AppShell>
  );
}
