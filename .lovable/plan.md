# Full Mascot Wearable Composites

## Goal
Add three illustrated Leo hats and permanently remove browser-positioned hat/accessory layers by rendering each equipped look as one complete mascot image.

## Artwork
- Create Leo wearing `hat-cap`, `hat-beanie`, and `hat-explorer` in his current soft-shaded chibi style.
- Regenerate every currently available hat and accessory as a complete mascot illustration using each mascot’s current base art.
- Preserve the current mascot identity, proportions, pose, lighting, outfit design, transparent canvas, item IDs, ownership, and prices.
- Keep desk toys, backgrounds, and outfit artwork unchanged.

## Combination coverage
- Preserve simultaneous outfit, hat, and accessory selections.
- Produce complete final-image variants for every valid combination, including base-with-item and outfit-with-item combinations.
- Generate combined hat-plus-accessory variants as complete images too, so no wearable layer is positioned over another in the browser.
- Only generate combinations for items visible to that mascot under the current catalog rules.

## Rendering changes
- Replace the separate base/outfit, hat, and accessory `<img>` stack with one resolved mascot image.
- Resolve the complete image from mascot + equipped outfit + equipped hat + equipped accessory.
- Use complete mascot composites in hat/accessory shop previews so the preview matches the fitted result.
- Fall back safely to the current outfit or base mascot only when no wearable combination is selected; never fall back to overlay positioning.

## Data safety
- Keep all existing item IDs, prices, ownership, unlock behavior, mascot IDs, and category rules unchanged.
- Do not change the purchase function because the three Leo hat IDs are already synchronized.

## Verification
- Confirm all generated image variants exist and no hat/accessory overlay code remains.
- Verify each mascot’s available hats/accessories alone and with every outfit.
- Verify Leo’s three new hats in the shop and equipped view.
- Test mobile and desktop layouts, image loading, category switching, and the final build.
