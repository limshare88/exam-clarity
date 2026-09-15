import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRefreshProfile } from "@/hooks/useProfile";
import { AppShell } from "@/components/AppShell";
import { Mascot } from "@/components/Mascot";
import { ShopIcon } from "@/components/ShopIcons";
import { BackgroundScene } from "@/components/BackgroundScenes";
import { CHILD_AVATARS, SHOP_ITEMS, type ShopItem } from "@/lib/subjects";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "Closet & Shop — ExamPulse" },
      { name: "description", content: "Dress Mika and Leo in starter and unlockable styles." },
      { property: "og:title", content: "Closet & Shop — ExamPulse" },
      { property: "og:description", content: "Choose outfits, hairstyles and accessories for Mika and Leo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Shop,
});

const CATEGORIES = ["Outfits", "Hairstyles", "Accessories", "Hats", "Desk Toys", "Backgrounds"] as const;
type ClosetCategory = (typeof CATEGORIES)[number];
// Categories with no avatar-specific items at all -- shown the same way for every mascot,
// so their heading skips the "for Mika/Leo" suffix that only makes sense for closet items
// actually tailored to one character.
const UNIVERSAL_ONLY_CATEGORIES = new Set<ClosetCategory>(["Hats", "Desk Toys", "Backgrounds"]);
type InventoryRow = { item_id: string; category: string; equipped: boolean; avatar_id: string | null };

function Shop() {
  const { data: profile } = useProfile();
  const refreshProfile = useRefreshProfile();
  const queryClient = useQueryClient();
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<ShopItem | null>(null);
  const [busy, setBusy] = useState(false);
  const activeAvatar = selectedAvatar ?? profile?.active_mascot ?? "mascot-chibi";

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gamification_inventory")
        .select("item_id, category, equipped, avatar_id");
      if (error) throw error;
      return data as InventoryRow[];
    },
  });

  // An item belongs to the current view if it's either scoped to the active avatar, or
  // has no avatar_id at all (a universal item -- Hats, Desk Toys, Backgrounds, and the
  // handful of pre-existing generic Outfits like fit-hoodie that predate the avatar-scoped
  // Outfits Mika/Leo have of their own). This is the same "no avatar_id, or it matches"
  // rule dashboard.tsx already uses for its equipped-lookup.
  const visibleItems = useMemo(
    () => SHOP_ITEMS.filter((item) => !("avatar_id" in item) || item.avatar_id === activeAvatar),
    [activeAvatar],
  );
  const owned = useMemo(
    () => new Set([...visibleItems.filter((item) => item.price === 0).map((item) => item.item_id), ...inventory.map((item) => item.item_id)]),
    [visibleItems, inventory],
  );
  const equipped = useMemo(() => {
    const result: Record<string, string | null> = {};
    // A universal item (e.g. fit-hoodie) and an avatar-scoped one (e.g. mika-outfit-cloud)
    // can end up equipped at the same time -- they're unequipped independently server-side,
    // scoped by avatar_id, so equipping one never touches the other's equipped flag. That's
    // a real but rare edge case (nothing in the UI encourages combining them); when it
    // happens, prefer the avatar-scoped item for what's actually shown on the character and
    // marked "Active", by writing avatar-scoped rows into the map first.
    const rows = inventory.filter((item) => item.equipped && (!item.avatar_id || item.avatar_id === activeAvatar));
    rows.sort((a, b) => (a.avatar_id ? -1 : 1) - (b.avatar_id ? -1 : 1));
    rows.forEach((item) => {
      if (!(item.category in result)) result[item.category] = item.item_id;
    });
    return result;
  }, [activeAvatar, inventory]);

  async function chooseAvatar(avatarId: string) {
    setSelectedAvatar(avatarId);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase.from("user_profiles").update({ active_mascot: avatarId }).eq("user_id", auth.user.id);
    if (error) toast.error(error.message);
    else refreshProfile();
  }

  async function unlockAndEquip(item: ShopItem) {
    setBusy(true);
    const { error } = await supabase.rpc("unlock_and_equip_closet_item", { p_item_id: item.item_id });
    if (error) {
      toast.error(error.message.includes("Not enough") ? "Not enough Pulse Coins yet. Finish another drill to earn more." : error.message);
    } else {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
      ]);
      toast.success(item.price === 0 ? `${item.item_name} is ready!` : `${item.item_name} is unlocked and equipped!`);
    }
    setBusy(false);
    setPendingItem(null);
  }

  function chooseItem(item: ShopItem) {
    if (owned.has(item.item_id)) void unlockAndEquip(item);
    else setPendingItem(item);
  }

  return (
    <AppShell
      title="Closet & Shop"
      subtitle="Create a look for Mika or Leo"
      right={<div className="rounded-2xl border-2 border-border bg-cream px-3 py-2 text-sm font-bold">🪙 {profile?.coins ?? 0}</div>}
    >
      <section className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(17rem,.9fr)]">
        <Mascot
          character={activeAvatar}
          outfit={equipped["Outfits"]}
          hairstyle={equipped["Hairstyles"]}
          accessory={equipped["Accessories"]}
          hat={equipped["Hats"]}
          toy={equipped["Desk Toys"]}
          background={equipped["Backgrounds"]}
          className="h-[23rem] rounded-2xl md:h-[30rem]"
        />
        <div className="flex flex-col justify-center gap-3">
          <p className="text-sm font-bold text-muted-foreground">Choose your learner</p>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Choose your learner">
            {CHILD_AVATARS.map((avatar) => {
              const selected = activeAvatar === avatar.item_id;
              return (
                <Button
                  key={avatar.item_id}
                  role="radio"
                  aria-checked={selected}
                  variant={selected ? "default" : "outline"}
                  onClick={() => void chooseAvatar(avatar.item_id)}
                  className="h-auto min-h-20 flex-col gap-1 rounded-2xl border-2"
                >
                  <span className="text-2xl" aria-hidden>{avatar.emoji}</span>
                  <span>{avatar.item_name}</span>
                </Button>
              );
            })}
          </div>
          <div className="rounded-2xl border-2 border-border bg-mint p-4 text-sm font-semibold text-mint-foreground">
            <Sparkles className="mr-2 inline h-4 w-4" />
            Two starter outfits are free for each learner.
          </div>
        </div>
      </section>

      <Tabs defaultValue="Outfits" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl border-2 border-border bg-card p-1">
          {CATEGORIES.map((category) => <TabsTrigger key={category} value={category} className="min-h-12 rounded-xl px-1 text-xs sm:text-sm">{category}</TabsTrigger>)}
        </TabsList>
        {CATEGORIES.map((category: ClosetCategory) => (
          <TabsContent key={category} value={category} className="space-y-3">
            <h2 className="text-xl font-bold">
              {category}
              {!UNIVERSAL_ONLY_CATEGORIES.has(category) &&
                ` for ${CHILD_AVATARS.find((a) => a.item_id === activeAvatar)?.item_name ?? "your learner"}`}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibleItems.filter((item) => item.category === category).length === 0 && (
                <p className="col-span-full rounded-2xl border-2 border-dashed border-border bg-cream p-4 text-center text-sm text-muted-foreground">
                  No {category.toLowerCase()} available for this companion yet.
                </p>
              )}
              {visibleItems.filter((item) => item.category === category).map((item) => {
                const isOwned = owned.has(item.item_id);
                const isEquipped = equipped[category] === item.item_id;
                return (
                  <article key={item.item_id} className={cn("relative flex min-w-0 flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center", isEquipped ? "border-primary bg-primary/10 shadow-md" : "border-border bg-cream")}>
                    {!isOwned && <span className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-card text-foreground shadow-md" aria-label="Locked"><Lock className="h-4 w-4" /></span>}
                    {isEquipped && <span className="absolute left-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">Active</span>}
                    <div className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded-xl bg-card/70">
                      {category === "Backgrounds" ? (
                        <BackgroundScene itemId={item.item_id} />
                      ) : (
                        <ShopIcon itemId={item.item_id} className="h-24 w-24" />
                      )}
                    </div>
                    <h3 className="min-h-12 text-sm font-semibold leading-snug">{item.item_name}</h3>
                    <Button disabled={busy || isEquipped} onClick={() => chooseItem(item)} variant={isOwned ? "secondary" : "default"} className="min-h-12 w-full rounded-xl px-2 text-sm">
                      {isEquipped ? "Wearing" : isOwned ? "Wear it" : `🪙 ${item.price} Coins`}
                    </Button>
                  </article>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <AlertDialog open={pendingItem !== null} onOpenChange={(open) => { if (!open && !busy) setPendingItem(null); }}>
        <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl border-2 border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock this outfit?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground">
              Unlock this outfit for {pendingItem?.price ?? 0} coins?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Not now</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); if (pendingItem) void unlockAndEquip(pendingItem); }}>
              {busy ? "Unlocking…" : "Confirm unlock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}