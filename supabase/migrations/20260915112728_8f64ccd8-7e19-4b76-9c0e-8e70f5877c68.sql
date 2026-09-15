-- The closet system rewrite replaced the old client-side buy/equip logic with this
-- SECURITY DEFINER RPC, which is the right call security-wise (price and ownership are
-- now validated server-side instead of trusted from the client) -- but its hardcoded
-- catalog only listed the new avatar-scoped Outfits/Hairstyles/Accessories items. The
-- pre-existing Hats, Desk Toys, and Backgrounds items (usable by any mascot, avatar_id
-- NULL) were left out entirely, so buying or equipping any of them called this function
-- with an item_id it didn't recognize and failed with "This closet item is not
-- available" -- which is what "all the toys & clothing are gone" was actually caused by.
--
-- This adds those items to the same catalog, and fixes the "unequip whatever was
-- equipped in this category before" step for them: it compared `gi.avatar_id =
-- v_avatar_id`, but SQL's `=` is never true when either side is NULL, so that step
-- silently did nothing for universal items (avatar_id NULL) -- switched to
-- `IS NOT DISTINCT FROM`, which treats NULL = NULL as a match, same as everywhere else
-- in the app already assumes (see dashboard.tsx's equipped-lookup, which was written
-- expecting NULL avatar_id to mean "applies to any mascot").
CREATE OR REPLACE FUNCTION public.unlock_and_equip_closet_item(p_item_id TEXT)
RETURNS TABLE (coins INTEGER, item_id TEXT, avatar_id TEXT, category TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_item_name TEXT;
  v_category TEXT;
  v_avatar_id TEXT;
  v_price INTEGER;
  v_coins INTEGER;
  v_owned BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501';
  END IF;

  SELECT x.item_name, x.category, x.avatar_id, x.price
  INTO v_item_name, v_category, v_avatar_id, v_price
  FROM (VALUES
    ('mika-outfit-cloud', 'Cloud Day Dress', 'Outfits', 'mascot-chibi', 0),
    ('mika-outfit-sailor', 'Lavender Sailor Set', 'Outfits', 'mascot-chibi', 0),
    ('leo-outfit-sky', 'Sky Explorer Set', 'Outfits', 'mascot-chibi-boy', 0),
    ('leo-outfit-varsity', 'Mint Varsity Set', 'Outfits', 'mascot-chibi-boy', 0),
    ('mika-outfit-starlight', 'Starlight Party Dress', 'Outfits', 'mascot-chibi', 50),
    ('mika-outfit-lab', 'Mika Science Coat', 'Outfits', 'mascot-chibi', 80),
    ('leo-outfit-cosmic', 'Cosmic Adventure Set', 'Outfits', 'mascot-chibi-boy', 50),
    ('leo-outfit-lab', 'Leo Science Coat', 'Outfits', 'mascot-chibi-boy', 80),
    ('mika-hair-braids', 'Ribbon Twin Braids', 'Hairstyles', 'mascot-chibi', 60),
    ('mika-hair-bob', 'Moonlight Bob', 'Hairstyles', 'mascot-chibi', 70),
    ('leo-hair-swoop', 'Starlight Swoop', 'Hairstyles', 'mascot-chibi-boy', 60),
    ('leo-hair-curls', 'Soft Cloud Curls', 'Hairstyles', 'mascot-chibi-boy', 70),
    ('mika-accessory-stars', 'Star Hair Clips', 'Accessories', 'mascot-chibi', 40),
    ('mika-accessory-satchel', 'Study Satchel', 'Accessories', 'mascot-chibi', 65),
    ('leo-accessory-headphones', 'Focus Headphones', 'Accessories', 'mascot-chibi-boy', 40),
    ('leo-accessory-backpack', 'Explorer Backpack', 'Accessories', 'mascot-chibi-boy', 65),
    ('hat-star', 'Star Beret', 'Hats', NULL, 40),
    ('hat-bunny', 'Bunny Ears', 'Hats', NULL, 60),
    ('hat-crown', 'Pastel Crown', 'Hats', NULL, 120),
    ('fit-hoodie', 'Mint Hoodie', 'Outfits', NULL, 80),
    ('fit-sailor', 'Lavender Uniform', 'Outfits', NULL, 110),
    ('fit-lab', 'Science Lab Coat', 'Outfits', NULL, 150),
    ('toy-cat', 'Desk Cat', 'Desk Toys', NULL, 50),
    ('toy-plant', 'Tiny Plant', 'Desk Toys', NULL, 35),
    ('toy-lamp', 'Glow Lamp', 'Desk Toys', NULL, 70),
    ('bg-study', 'Cozy Study Room', 'Backgrounds', NULL, 90),
    ('bg-night', 'Starry Night Bedroom', 'Backgrounds', NULL, 130),
    ('bg-classroom', 'Bright Classroom', 'Backgrounds', NULL, 110)
  ) AS x(item_id, item_name, category, avatar_id, price)
  WHERE x.item_id = p_item_id;

  IF v_item_name IS NULL THEN
    RAISE EXCEPTION 'This closet item is not available.' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gamification_inventory gi
    WHERE gi.user_id = v_user_id AND gi.item_id = p_item_id
  ) INTO v_owned;

  SELECT up.coins INTO v_coins
  FROM public.user_profiles up
  WHERE up.user_id = v_user_id
  FOR UPDATE;

  IF v_coins IS NULL THEN
    RAISE EXCEPTION 'Your learner profile could not be found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_owned THEN
    IF v_coins < v_price THEN
      RAISE EXCEPTION 'Not enough Pulse Coins yet.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.user_profiles up
    SET coins = up.coins - v_price
    WHERE up.user_id = v_user_id
    RETURNING up.coins INTO v_coins;

    INSERT INTO public.gamification_inventory (
      user_id, item_id, item_name, category, price, equipped, avatar_id
    ) VALUES (
      v_user_id, p_item_id, v_item_name, v_category, v_price, false, v_avatar_id
    )
    ON CONFLICT (user_id, item_id) DO NOTHING;
  END IF;

  UPDATE public.gamification_inventory gi
  SET equipped = false
  WHERE gi.user_id = v_user_id
    AND gi.avatar_id IS NOT DISTINCT FROM v_avatar_id
    AND gi.category = v_category;

  UPDATE public.gamification_inventory gi
  SET equipped = true
  WHERE gi.user_id = v_user_id
    AND gi.item_id = p_item_id;

  RETURN QUERY SELECT v_coins, p_item_id, v_avatar_id, v_category;
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_and_equip_closet_item(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_and_equip_closet_item(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_and_equip_closet_item(TEXT) TO service_role;
