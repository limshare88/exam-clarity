import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mascot } from "@/components/Mascot";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ExamPulse — Calm exam practice for focused minds" },
      {
        name: "description",
        content:
          "Sign in to ExamPulse and practise exam questions in a calm, high-contrast workspace built for dyslexia and autism.",
      },
      { property: "og:title", content: "ExamPulse — Calm exam practice" },
      {
        property: "og:description",
        content: "Decode exam questions, build strategies, earn Pulse Coins.",
      },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/dashboard" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function signInWithGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setBusy(false);
    if (result.error) {
      toast.error("Google sign-in didn't work. Please try the email link instead.");
      return;
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-4xl">💜</p>
          <h1 className="mt-2 text-4xl font-bold">ExamPulse</h1>
          <p className="mt-2 text-base text-muted-foreground">
            A calm place to practise exam questions, one clear step at a time.
          </p>
        </div>

        <Mascot mood="calm" wallpaper="bg-mint" />

        <div className="surface-card space-y-5 p-6">
          <Button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="tap-lg w-full rounded-2xl text-base"
          >
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-0.5 flex-1 bg-border" /> or use a sign-in link
            <span className="h-0.5 flex-1 bg-border" />
          </div>

          {sent ? (
            <div className="rounded-2xl border-2 border-border bg-mint p-4 text-center">
              <p className="font-semibold">Check your email 📬</p>
              <p className="mt-1 text-sm">
                We sent a one-tap sign-in link to {email}. No password needed.
              </p>
            </div>
          ) : (
            <form onSubmit={sendLink} className="space-y-3">
              <Label htmlFor="email" className="text-base">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="tap-lg rounded-2xl border-2 text-base"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={busy}
                className="tap-lg w-full rounded-2xl border-2 border-border text-base"
              >
                Send me a sign-in link
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Everything you save stays private to your own account.
        </p>
      </div>
    </div>
  );
}
