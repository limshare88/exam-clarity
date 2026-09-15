-- Leo was sharing Mika's exact hat designs (a beret with a bow, bunny ears, a jewelled
-- crown) re-rendered in his art style -- reasonable proportions once positioned
-- correctly, but the wrong designs entirely for a boy character. Hats need the same
-- per-mascot catalog Outfits and Accessories already have, not a shared pool.
--
-- Scopes the 3 existing hats to Mika (avatar_id 'mascot-chibi', unchanged item_ids so her
-- existing art keeps working) and adds 3 new item_ids for Leo with boy-appropriate names.
-- Their actual artwork doesn't exist yet -- ShopIcon/getMascotCompositeAsset return null
-- for a missing asset, so they'll show with an empty preview box until generated, the
-- same graceful placeholder state any not-yet-illustrated item already gets.
--
-- Everything else here is copied unchanged from the previous version (including Mallow's
-- and Pip's outfit/accessory entries, SECURITY INVOKER, and the named-constraint ON
-- CONFLICT clause) to avoid clobbering that work.
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
