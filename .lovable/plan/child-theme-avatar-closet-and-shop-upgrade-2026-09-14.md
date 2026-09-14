# Child Theme avatar closet and shop upgrade

## What will change

- Rework Leo into the same premium soft-shaded anime-chibi finish as Mika, including matching proportions, detailed hair highlights, glass-like eyes, skin shading, and transparent full-body framing.
- Turn the Toy Shop into a mobile-first **Closet & Shop** for Mika and Leo with a live character preview, avatar switcher, item categories, clear owned/active/locked states, and consistent sensory-friendly styling.
- Give each character exactly two free starter outfits, available immediately without spending coins.
- Add character-compatible premium outfits, hairstyles, and accessories with visible lock overlays and coin prices.
- Add an unlock confirmation dialog using the exact purchase prompt, then equip successful purchases automatically.
- Bring toy icons and scenic backgrounds into the same polished, soft-shaded illustration language without changing the app’s established child-friendly palette.

## Purchase and save behavior

- Move purchasing into one authenticated database operation so checking the balance, deducting coins, unlocking the item, and equipping it either all succeed together or do nothing.
- Prevent duplicate purchases and negative balances, and keep every learner’s closet private.
- Persist free outfit selections as inventory records when first worn, so they remain equipped after refresh and across the dashboard and practice screens.
- Scope wearable selections to Mika or Leo so each character remembers their own outfit, hairstyle, and accessory when switching avatars.
- Continue using the existing learner profile database as the authoritative coin balance. This project does not currently use Google Sheets for profiles; no separate sheet copy will be introduced.

## Technical details

- Extend shop item metadata with avatar compatibility, wearable slot, starter status, and preview artwork.
- Add a secure purchase/equip database function and any minimal inventory columns needed for avatar-specific equipment, with grants and row-level protection.
- Update the shared avatar renderer so the active character and selected wearable layers render consistently everywhere.
- Generate and store the revised Leo artwork plus the new coordinated wearable art as project assets.
- Verify purchase confirmation, insufficient funds, free outfit wear, character switching, persistence, and mobile/desktop layouts.
