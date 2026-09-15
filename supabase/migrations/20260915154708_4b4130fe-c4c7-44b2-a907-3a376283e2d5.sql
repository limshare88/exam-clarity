-- Every closet category could only ever be swapped between items -- there was no way to
-- go back to "wearing nothing" once something was equipped, since unlock_and_equip_closet_item
-- only ever sets one specific item to equipped=true (unequipping whatever was there before
-- in the same category as a side effect), never sets a whole category back to nothing worn.
--
-- This adds a companion RPC for exactly that: clear whatever's equipped in one category for
-- one avatar scope, with no item to equip in its place. Doesn't touch coins or ownership --
-- items stay in the user's inventory, just unequipped, so re-equipping later is instant and
-- free, same as switching between any two owned items today.
CREATE OR REPLACE FUNCTION public.unequip_closet_category(p_category TEXT, p_avatar_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.gamification_inventory gi
  SET equipped = false
  WHERE gi.user_id = v_user_id
    AND gi.category = p_category
    AND gi.avatar_id IS NOT DISTINCT FROM p_avatar_id;
END;
$$;

REVOKE ALL ON FUNCTION public.unequip_closet_category(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unequip_closet_category(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unequip_closet_category(TEXT, TEXT) TO service_role;
