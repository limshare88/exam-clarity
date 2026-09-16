// Illustrated photo-style backgrounds, loaded the same way ShopIcons.tsx loads wardrobe
// art. Keyed by item_id, e.g. "leo-bg-museum".
const backgroundImageModules = import.meta.glob<{ default: string }>(
  "/src/assets/backgrounds/*.webp",
  { eager: true, query: "?url" },
);

function getBackgroundImageAsset(itemId: string): string | null {
  return backgroundImageModules[`/src/assets/backgrounds/${itemId}.webp`]?.default ?? null;
}

// Shown behind a character when no Background item is equipped, instead of the plain
// sky-blue fill -- a mascot-specific "home base" scene rather than a purchasable item.
// Characters with no entry here keep the plain colour fallback.
const DEFAULT_BACKGROUNDS: Record<string, string> = {
  "mascot-chibi": "mika-bg-landing",
  "mascot-chibi-boy": "leo-bg-playground",
};

/** Renders the illustrated image for a background item id, or (if nothing is equipped)
 * the equipping character's default backdrop if it has one, else null for the plain
 * colour fallback. The three flat hand-drawn SVG scenes this used to also support
 * (Cozy Study Room, Starry Night Bedroom, Bright Classroom) were removed -- once the
 * illustrated image-based backgrounds existed, they looked noticeably worse by
 * comparison, so they were retired rather than kept as a lesser-looking option. */
export function BackgroundScene({
  itemId,
  character,
}: {
  itemId: string | null | undefined;
  character?: string | null | undefined;
}) {
  const resolvedId = itemId ?? DEFAULT_BACKGROUNDS[character ?? ""];
  if (!resolvedId) return null;

  const image = getBackgroundImageAsset(resolvedId);
  if (!image) return null;

  return (
    <div className="absolute inset-0" aria-hidden>
      <img src={image} alt="" className="h-full w-full object-cover" />
    </div>
  );
}
