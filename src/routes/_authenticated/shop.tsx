import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRefreshProfile } from "@/hooks/useProfile";
import { AppShell } from "@/components/AppShell";
import { Mascot } from "@/components/Mascot";
import { SHOP_ITEMS } from "@/lib/subjects";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "Toy shop — ExamPulse" },
      {
        name: "description",
        content: "Spend your Pulse Coins on hats, outfits, desk toys and room wallpapers.",
      },
      { property: "og:title", content: "Toy shop — ExamPulse" },
      { property: "og:description", content: "Dress up your mascot with earned Pulse Coins." },
    ],
  }),
  component: Shop,
});

const CATEGORIES = ["Mascots", "Hats", "Outfits", "Desk Toys", "Wallpapers"] as const;

function Shop() {
  const { data: profile } = useProfile();
  const refreshProfile = useRefreshProfile();
  const qc = useQueryClient();

  const { data: inventory } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gamification_inventory")
        .select("item_id, category, equipped");
      return data ?? [];
    },
  });

  const owned = useMemo(
    () => new Set(["mascot-chibi", ...(inventory ?? []).map((i) => i.item_id)]),
    [inventory],
  );
  const equipped = useMemo(() => {
    const map: Record<string, string | null> = {};
    (inventory ?? [])
      .filter((i) => i.equipped)
      .forEach((i) => {
        const item = SHOP_ITEMS.find((s) => s.item_id === i.item_id);
        if (item) map[item.category] = item.category === "Wallpapers" || item.category === "Mascots" ? item.item_id : item.emoji;
      });
    return map;
  }, [inventory]);

  async function buy(itemId: string) {
    const item = SHOP_ITEMS.find((i) => i.item_id === itemId);
    if (!item) return;
    if ((profile?.coins ?? 0) < item.price) {
      toast.error("Not enough Pulse Coins yet. Finish another drill to earn more.");
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) { toast.error("Please sign in again."); return; }
    const { error } = await supabase.from("gamification_inventory").insert({
      user_id: uid,
      item_id: item.item_id,
      item_name: item.item_name,
      category: item.category,
      price: item.price,
    });
    if (error) { toast.error(error.message); return; }
    await supabase
      .from("user_profiles")
      .update({ coins: (profile?.coins ?? 0) - item.price })
      .eq("user_id", uid);
    refreshProfile();
    qc.invalidateQueries({ queryKey: ["inventory"] });
    toast.success(`${item.item_name} is yours!`);
    if (item.category === "Mascots") await equip(item.item_id, item.category);
  }

  async function equip(itemId: string, category: string) {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) { toast.error("Please sign in again."); return; }
    if (category === "Mascots") {
      const { error } = await supabase
        .from("user_profiles")
        .update({ active_mascot: itemId })
        .eq("user_id", uid);
      if (error) { toast.error(error.message); return; }
      refreshProfile();
    }
    await supabase
      .from("gamification_inventory")
      .update({ equipped: false })
      .eq("user_id", uid)
      .eq("category", category);
    await supabase
      .from("gamification_inventory")
      .update({ equipped: true })
      .eq("user_id", uid)
      .eq("item_id", itemId);
    qc.invalidateQueries({ queryKey: ["inventory"] });
  }

  return (
    <AppShell
      title="Toy shop"
      subtitle="Spend your Pulse Coins"
      right={
        <div className="rounded-2xl border-2 border-border bg-cream px-3 py-2 text-sm font-bold">
          🪙 {profile?.coins ?? 0}
        </div>
      }
    >
      <section className="surface-card p-4">
        <Mascot
          character={profile?.active_mascot}
          hat={equipped["Hats"]}
          outfit={equipped["Outfits"]}
          toy={equipped["Desk Toys"]}
          wallpaper={equipped["Wallpapers"]}
        />
      </section>

      <Tabs defaultValue="Mascots" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl border-2 border-border bg-card p-1 sm:grid-cols-5">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat} value={cat} className="min-h-11 whitespace-normal rounded-xl px-2 text-xs sm:text-sm">
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>
        {CATEGORIES.map((cat) => (
          <TabsContent key={cat} value={cat} className="space-y-3">
          <h2 className="text-xl font-bold">{cat}</h2>
          <div className="grid grid-cols-2 gap-3">
            {SHOP_ITEMS.filter((i) => i.category === cat).map((item) => {
              const isOwned = owned.has(item.item_id);
              const isEquipped =
                cat === "Mascots"
                  ? profile?.active_mascot === item.item_id
                  : equipped[cat] === (cat === "Wallpapers" ? item.item_id : item.emoji);
              return (
                <div
                  key={item.item_id}
                  className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-cream p-4 text-center"
                >
                  {cat === "Mascots" ? (
                    <Mascot character={item.item_id} className="h-40 rounded-xl border" />
                  ) : (
                    <span className="text-4xl">{item.emoji}</span>
                  )}
                  <span className="text-sm font-semibold">{item.item_name}</span>
                  {isOwned ? (
                    <Button
                      onClick={() => equip(item.item_id, cat)}
                      variant={isEquipped ? "default" : "secondary"}
                      className="tap-lg w-full rounded-2xl border-2 border-border text-sm"
                    >
                      {isEquipped ? "Wearing" : "Wear it"}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => buy(item.item_id)}
                      className="tap-lg w-full rounded-2xl text-sm"
                    >
                      🪙 {item.price}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}
