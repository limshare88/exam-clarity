-- Hairstyles are being removed from the app entirely. Drop them from the closet RPC's
-- catalog so they can no longer be bought/equipped, and clean up any inventory rows a
-- user may already have for them (equipped or not) so nothing dangling is left behind
-- for a category the UI no longer has a tab for.
DELETE FROM public.gamification_inventory
WHERE item_id IN ('mika-hair-braids', 'mika-hair-bob', 'leo-hair-swoop', 'leo-hair-curls');

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

-- Mallow and Pip now cost Pulse Coins to unlock (Mika and Leo stay free, selectable
-- directly on the client without ever calling this). Mirrors the closet item RPC's
-- shape: validate against a hardcoded catalog, charge coins once, record ownership as a
-- gamification_inventory row (category 'Mascots') so re-selecting later is free, then set
-- the mascot as the user's active_mascot.
CREATE OR REPLACE FUNCTION public.unlock_and_select_mascot(p_mascot_id TEXT)
RETURNS TABLE (coins INTEGER, mascot_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mascot_name TEXT;
  v_price INTEGER;
  v_coins INTEGER;
  v_owned BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501';
  END IF;

  SELECT x.mascot_name, x.price
  INTO v_mascot_name, v_price
  FROM (VALUES
    ('mascot-chibi', 'Mika', 0),
    ('mascot-chibi-boy', 'Leo', 0),
    ('mascot-long-ear', 'Mallow', 150),
    ('mascot-robot', 'Pip', 150)
  ) AS x(mascot_id, mascot_name, price)
  WHERE x.mascot_id = p_mascot_id;

  IF v_mascot_name IS NULL THEN
    RAISE EXCEPTION 'This companion is not available.' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gamification_inventory gi
    WHERE gi.user_id = v_user_id AND gi.item_id = p_mascot_id AND gi.category = 'Mascots'
  ) INTO v_owned;

  SELECT up.coins INTO v_coins
  FROM public.user_profiles up
  WHERE up.user_id = v_user_id
  FOR UPDATE;

  IF v_coins IS NULL THEN
    RAISE EXCEPTION 'Your learner profile could not be found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_owned AND v_price > 0 THEN
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
      v_user_id, p_mascot_id, v_mascot_name, 'Mascots', v_price, true, NULL
    )
    ON CONFLICT (user_id, item_id) DO NOTHING;
  END IF;

  UPDATE public.user_profiles up
  SET active_mascot = p_mascot_id
  WHERE up.user_id = v_user_id;

  RETURN QUERY SELECT v_coins, p_mascot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_and_select_mascot(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_and_select_mascot(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_and_select_mascot(TEXT) TO service_role;
