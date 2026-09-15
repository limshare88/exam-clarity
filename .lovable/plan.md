# Mascot Customization Art and Fit Redesign

## Goal
Replace the flat sticker-style wardrobe art with polished, shaded illustration assets that match Mika, Leo, Mallow, and Pip, while preserving all existing mascot IDs, unlock rules, prices, and the removed Hairstyles category.

## Art system
- Use each existing mascot illustration as the visual reference for linework, shading, lighting, proportions, and canvas alignment.
- Replace SVG wardrobe previews with transparent PNG illustration assets.
- Create outfit renders as full mascot-plus-outfit compositions so clothing follows the body rather than floating over it.
- Create mascot-specific full-canvas hat and accessory layers aligned to each mascot’s native canvas. This avoids one shared position/scale while still allowing outfit, hat, and accessory combinations without generating every possible combination.
- Keep desk toys universal, but redraw the cat, plant, and lamp as polished shaded illustrations.
- Keep backgrounds unchanged; the request targets wearable items and desk toys.

## Catalog coverage
- Preserve all current item IDs and prices.
- Redraw Mika and Leo’s existing outfits and accessories.
- Add two Mallow outfits at the existing 50/80 coin tiers and two Mallow accessories at 40/65 coins.
- Add two Pip outfits at the existing 50/80 coin tiers and two Pip accessories at 40/65 coins.
- Give all four mascots fitted versions of the existing Star Beret, Bunny Ears, and Pastel Crown without changing those shared item IDs or prices.
- Render the existing universal Mint Hoodie, Lavender Uniform, and Science Lab Coat appropriately for each body type; Mallow and Pip receive cape/collar/shell or paint-job interpretations rather than human clothing.
- Add every new Mallow/Pip item to both the client catalog and the authoritative purchase function in the same change.

## Interface and rendering
- Replace the shared `DEFAULT_LAYOUT` positioning with an explicit per-mascot asset lookup.
- When an outfit is equipped, swap to its precomposited mascot render; otherwise show the base mascot.
- Render hats and accessories as mascot-specific, canvas-aligned transparent layers at full character-canvas size, with defined front/behind ordering where ears, hair, or antennae require it.
- Use the same illustrated assets in shop cards so the preview matches what appears on the mascot.
- Keep Hats and Desk Toys universal in ownership, while their displayed hat artwork adapts to the active mascot.
- Update shop wording from “Mika or Leo” to all four mascots without changing Mallow/Pip coin unlocking.

## Data safety
- Extend `unlock_and_equip_closet_item` with exactly the new Mallow/Pip IDs, names, avatar scopes, categories, and agreed prices.
- Do not alter existing prices, mascot IDs/names, profile coin behavior, mascot unlock prices, or inventory ownership rules.
- Keep Hairstyles absent from the catalog, tabs, rendering, and purchase function.

## Verification
- Validate that the client and purchase catalogs contain the same purchasable IDs and prices.
- Test free/existing items and new premium items through the real unlock/equip flow.
- Check every mascot with each outfit, hat, and accessory category, including Mallow ears and Pip antenna/body contours.
- Verify shop cards and equipped results on mobile and desktop, with no overflow or browser errors.
- Resolve the current generated database typing mismatch for the mascot unlock action and confirm the final build is healthy.
