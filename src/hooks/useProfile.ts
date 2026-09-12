import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  user_id: string;
  name: string;
  age: number | null;
  subjects: { subject: string; board: string }[];
  learning_profile: string[];
  timer_seconds: number;
  coins: number;
  stars: number;
  onboarded: boolean;
};

export async function fetchProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    const { data: created, error: insertError } = await supabase
      .from("user_profiles")
      .insert({ user_id: user.id, name: "" })
      .select("*")
      .single();
    if (insertError) throw insertError;
    return created as unknown as Profile;
  }
  return data as unknown as Profile;
}

export function useProfile() {
  return useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
}

export function useRefreshProfile() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["profile"] });
}

export async function awardCoins(coins: number, stars = 0) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return;
  const { data } = await supabase
    .from("user_profiles")
    .select("coins, stars")
    .eq("user_id", user.id)
    .maybeSingle();
  await supabase
    .from("user_profiles")
    .update({ coins: (data?.coins ?? 0) + coins, stars: (data?.stars ?? 0) + stars })
    .eq("user_id", user.id);
}
