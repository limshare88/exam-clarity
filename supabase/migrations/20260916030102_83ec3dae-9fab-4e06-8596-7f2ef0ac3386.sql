-- Mallow gets her own set of purchasable backgrounds, completing the set alongside Leo's,
-- Mika's, and Pip's: Dreamy Meadow, Starlit Forest, Moonlit Shore, Cloud Observatory. Her
-- 5th, the moonlit archway meadow, isn't a catalog item -- it's her per-character default
-- scene (see BackgroundScenes.tsx's DEFAULT_BACKGROUNDS), same as the other three.
--
-- All four mascots now have their own complete illustrated background set.
--
-- Everything else copied unchanged from the previous version to avoid clobbering it.
CREATE OR REPLACE FUNCTION public.unlock_and_equip_closet_item(p_item_id TEXT)
RETURNS TABLE (coins INTEGER, item_id TEXT, avatar_id TEXT, category TEXT)
LANGUAGE plpgsql
SECURITY INVOKER
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
    ('mallow-outfit-stargazer', 'Stargazer Cape', 'Outfits', 'mascot-long-ear', 50),
    ('mallow-outfit-scholar', 'Scholar Mantle', 'Outfits', 'mascot-long-ear', 80),
    ('pip-outfit-explorer', 'Explorer Shell', 'Outfits', 'mascot-robot', 50),
    ('pip-outfit-science', 'Science Shell', 'Outfits', 'mascot-robot', 80),
    ('mika-accessory-stars', 'Star Hair Clips', 'Accessories', 'mascot-chibi', 40),
    ('mika-accessory-satchel', 'Study Satchel', 'Accessories', 'mascot-chibi', 65),
    ('leo-accessory-headphones', 'Focus Headphones', 'Accessories', 'mascot-chibi-boy', 40),
    ('leo-accessory-backpack', 'Explorer Backpack', 'Accessories', 'mascot-chibi-boy', 65),
    ('mallow-accessory-moon', 'Moon Charm Collar', 'Accessories', 'mascot-long-ear', 40),
    ('mallow-accessory-books', 'Book Satchel Harness', 'Accessories', 'mascot-long-ear', 65),
    ('pip-accessory-signals', 'Signal Light Charms', 'Accessories', 'mascot-robot', 40),
    ('pip-accessory-tools', 'Tool Backpack Module', 'Accessories', 'mascot-robot', 65),
    ('hat-star', 'Star Beret', 'Hats', 'mascot-chibi', 40),
    ('hat-bunny', 'Bunny Ears', 'Hats', 'mascot-chibi', 60),
    ('hat-crown', 'Pastel Crown', 'Hats', 'mascot-chibi', 120),
    ('hat-cap', 'Backwards Cap', 'Hats', 'mascot-chibi-boy', 40),
    ('hat-beanie', 'Cozy Beanie', 'Hats', 'mascot-chibi-boy', 60),
    ('hat-explorer', 'Explorer Hat', 'Hats', 'mascot-chibi-boy', 120),
    ('fit-hoodie', 'Mint Hoodie', 'Outfits', NULL, 80),
    ('fit-sailor', 'Lavender Uniform', 'Outfits', NULL, 110),
    ('fit-lab', 'Science Lab Coat', 'Outfits', NULL, 150),
    ('toy-cat', 'Desk Cat', 'Desk Toys', NULL, 50),
    ('toy-plant', 'Tiny Plant', 'Desk Toys', NULL, 35),
    ('toy-lamp', 'Glow Lamp', 'Desk Toys', NULL, 70),
    ('leo-bg-study', 'Study Room', 'Backgrounds', 'mascot-chibi-boy', 90),
    ('leo-bg-cafe', 'Cosy Cafe', 'Backgrounds', 'mascot-chibi-boy', 100),
    ('leo-bg-lab', 'Science Lab', 'Backgrounds', 'mascot-chibi-boy', 120),
    ('leo-bg-museum', 'Dinosaur Museum', 'Backgrounds', 'mascot-chibi-boy', 140),
    ('mika-bg-study', 'Study Room', 'Backgrounds', 'mascot-chibi', 90),
    ('mika-bg-street', 'Street View', 'Backgrounds', 'mascot-chibi', 105),
    ('mika-bg-cafe', 'Cherry Blossom Cafe', 'Backgrounds', 'mascot-chibi', 115),
    ('mika-bg-themepark', 'Theme Park', 'Backgrounds', 'mascot-chibi', 150),
    ('pip-bg-server', 'Server Room', 'Backgrounds', 'mascot-robot', 95),
    ('pip-bg-toystore', 'Retro Toy Store', 'Backgrounds', 'mascot-robot', 105),
    ('pip-bg-greenhouse', 'Space Greenhouse', 'Backgrounds', 'mascot-robot', 130),
    ('pip-bg-cybercity', 'Neon Cyber City', 'Backgrounds', 'mascot-robot', 150),
    ('mallow-bg-meadow', 'Dreamy Meadow', 'Backgrounds', 'mascot-long-ear', 90),
    ('mallow-bg-forest', 'Starlit Forest', 'Backgrounds', 'mascot-long-ear', 110),
    ('mallow-bg-shore', 'Moonlit Shore', 'Backgrounds', 'mascot-long-ear', 120),
    ('mallow-bg-observatory', 'Cloud Observatory', 'Backgrounds', 'mascot-long-ear', 150)
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
    ON CONFLICT ON CONSTRAINT gamification_inventory_user_id_item_id_key DO NOTHING;
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
