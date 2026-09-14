import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { AppShell } from "@/components/AppShell";
import { Mascot } from "@/components/Mascot";
import { SHOP_ITEMS } from "@/lib/subjects";
import { summariseStumbleBlocks } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your progress — ExamPulse" },
      {
        name: "description",
        content: "See your processing speed, subject mastery and the words you find hardest.",
      },
      { property: "og:title", content: "Your progress — ExamPulse" },
      { property: "og:description", content: "Processing speed, mastery and stumble blocks." },
    ],
  }),
  component: Dashboard,
});

type Log = {
  created_at: string;
  subject: string | null;
  marks: number;
  time_seconds: number;
  score: number | null;
};

function Dashboard() {
  const { data: profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const [range, setRange] = useState<7 | 30>(7);
  const summarise = useServerFn(summariseStumbleBlocks);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);

  useEffect(() => {
    if (profile && !profile.onboarded) navigate({ to: "/onboarding" });
  }, [profile, navigate]);

  const { data: logs } = useQuery({
    queryKey: ["logs", range],
    queryFn: async () => {
      const since = new Date(Date.now() - range * 864e5).toISOString();
      const { data } = await supabase
        .from("session_logs")
        .select("created_at, subject, marks, time_seconds, score")
        .gte("created_at", since)
        .order("created_at");
      return (data ?? []) as Log[];
    },
  });

  const { data: inventory } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gamification_inventory")
        .select("item_id, category, equipped, avatar_id");
      return data ?? [];
    },
  });

  const equipped = useMemo(() => {
    const map: Record<string, string | null> = { Hats: null, Outfits: null, "Desk Toys": null, Backgrounds: null };
    (inventory ?? [])
      .filter((i) => i.equipped && (!i.avatar_id || i.avatar_id === profile?.active_mascot))
      .forEach((i) => {
        const item = SHOP_ITEMS.find((s) => s.item_id === i.item_id);
        if (item) map[item.category] = item.item_id;
      });
    return map;
  }, [inventory, profile?.active_mascot]);

  const chartData = useMemo(() => {
    const byDay = new Map<string, { marks: number; secs: number }>();
    (logs ?? []).forEach((l) => {
      const day = new Date(l.created_at).toISOString().slice(5, 10);
      const prev = byDay.get(day) ?? { marks: 0, secs: 0 };
      byDay.set(day, { marks: prev.marks + (l.marks || 1), secs: prev.secs + Number(l.time_seconds) });
    });
    return Array.from(byDay.entries()).map(([day, v]) => ({
      day,
      seconds: Number((v.secs / Math.max(v.marks, 1)).toFixed(1)),
    }));
  }, [logs]);

  const mastery = useMemo(() => {
    const groups: Record<string, number[]> = {};
    (logs ?? []).forEach((l) => {
      if (l.score == null) return;
      const key = l.subject ?? "Other";
      (groups[key] ??= []).push(l.score);
    });
    return Object.entries(groups).map(([subject, scores]) => ({
      subject,
      pct: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));
  }, [logs]);

  async function loadSummary() {
    setSummaryBusy(true);
    try {
      const res = await summarise({});
      setSummary(res.summary);
    } catch (e) {
      setSummary(e instanceof Error ? e.message : "Could not load the summary.");
    }
    setSummaryBusy(false);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell
      title={`Hi ${profile?.name || "there"} 👋`}
      subtitle="Calm progress, one question at a time"
      right={
        <div className="rounded-2xl border-2 border-border bg-cream px-3 py-2 text-sm font-bold">
          🪙 {profile?.coins ?? 0} · ⭐ {profile?.stars ?? 0}
        </div>
      }
    >
      <section className="surface-card space-y-4 p-4">
        <Mascot
          character={profile?.active_mascot}
          hat={equipped["Hats"]}
          outfit={equipped["Outfits"]}
          hairstyle={equipped["Hairstyles"]}
          accessory={equipped["Accessories"]}
          toy={equipped["Desk Toys"]}
          background={equipped["Backgrounds"]}
          mood="cheer"
        />
        <div className="flex gap-3">
          <Link to="/practice" className="flex-1">
            <Button className="tap-lg w-full rounded-2xl text-base">Start practising</Button>
          </Link>
          <Link to="/shop" className="flex-1">
            <Button variant="secondary" className="tap-lg w-full rounded-2xl border-2 border-border text-base">
              Closet & Shop
            </Button>
          </Link>
        </div>
      </section>

      <section className="surface-card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">⏳ Seconds per mark</h2>
          <div className="flex gap-2">
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-xl border-2 border-border px-3 py-2 text-sm font-semibold ${
                  range === r ? "bg-primary text-primary-foreground" : "bg-cream"
                }`}
              >
                {r} days
              </button>
            ))}
          </div>
        </div>
        <div className="h-56 w-full">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="4 6" stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "2px solid var(--color-border)",
                    background: "var(--color-card)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="seconds"
                  stroke="var(--color-chart-1)"
                  strokeWidth={4}
                  dot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-center text-muted-foreground">
              Finish a question and your speed will show here.
            </p>
          )}
        </div>
      </section>

      <section className="surface-card space-y-3 p-5">
        <h2 className="text-xl font-bold">🎯 Subject mastery</h2>
        {mastery.length ? (
          <div className="grid grid-cols-2 gap-3">
            {mastery.map((m) => (
              <div key={m.subject} className="rounded-2xl border-2 border-border bg-mint p-4">
                <p className="text-sm font-semibold">{m.subject}</p>
                <p className="text-3xl font-bold">{m.pct}%</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No marked strategies yet.</p>
        )}
      </section>

      <section className="surface-card space-y-3 p-5">
        <h2 className="text-xl font-bold">🧩 Stumble blocks</h2>
        <div className="rounded-2xl border-2 border-border bg-lavender p-4">
          {summary ? (
            <p className="reading-text text-base">{summary}</p>
          ) : (
            <p className="text-muted-foreground">
              Tap below for a short summary of the words and command words you find hardest.
            </p>
          )}
        </div>
        <Button
          onClick={loadSummary}
          disabled={summaryBusy}
          variant="secondary"
          className="tap-lg w-full rounded-2xl border-2 border-border"
        >
          {summaryBusy ? "Thinking…" : "Refresh summary"}
        </Button>
      </section>
    </AppShell>
  );
}
