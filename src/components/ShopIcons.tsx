import { cn } from "@/lib/utils";

type AvatarKey = "mika" | "leo" | "mallow" | "pip";

const AVATAR_KEYS: Record<string, AvatarKey> = {
  "mascot-chibi": "mika",
  "mascot-chibi-boy": "leo",
  "mascot-long-ear": "mallow",
  "mascot-robot": "pip",
};

const pieceModules = import.meta.glob<{ default: string }>(
  "/src/assets/wardrobe/pieces/*.webp",
  { eager: true, query: "?url" },
);

const compositeModules = import.meta.glob<{ default: string }>(
  "/src/assets/wardrobe/composites/*.webp",
  { eager: true, query: "?url" },
);

function assetFrom(
  modules: Record<string, { default: string }>,
  directory: "pieces" | "composites",
  fileName: string,
) {
  return modules[`/src/assets/wardrobe/${directory}/${fileName}.webp`]?.default ?? null;
}

export function mascotArtKey(character?: string | null): AvatarKey {
  return AVATAR_KEYS[character ?? ""] ?? "mika";
}

export function getShopPieceAsset(itemId: string, character?: string | null) {
  const avatar = mascotArtKey(character);
  const fittedId = itemId.startsWith("hat-") || itemId.startsWith("fit-")
    ? `${avatar}--${itemId}`
    : itemId;
  return assetFrom(pieceModules, "pieces", fittedId);
}

export function getMascotCompositeAsset(
  itemId: string | null | undefined,
  character?: string | null,
) {
  if (!itemId) return null;
  const avatar = mascotArtKey(character);
  const fittedId = itemId.startsWith("fit-") || itemId.startsWith("hat-")
    ? `${avatar}--${itemId}`
    : `${avatar}--${itemId}`;
  return assetFrom(compositeModules, "composites", fittedId);
}

/** Resolves one flattened character image for the complete equipped look. */
export function getMascotLookAsset(
  character?: string | null,
  outfit?: string | null,
  hat?: string | null,
  accessory?: string | null,
) {
  const avatar = mascotArtKey(character);
  if (hat || accessory) {
    return assetFrom(
      compositeModules,
      "composites",
      `${avatar}--look--${outfit || "base"}--${hat || "none"}--${accessory || "none"}`,
    );
  }
  return getMascotCompositeAsset(outfit, character);
}

export function ShopIcon({
  itemId,
  character,
  className,
}: {
  itemId: string;
  character?: string | null | undefined;
  className?: string;
}) {
  const src = getShopPieceAsset(itemId, character);
  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      width={420}
      height={420}
      loading="lazy"
      className={cn("object-contain", className)}
    />
  );
}

export const HAS_SHOP_ICON = (itemId: string, character?: string | null | undefined): boolean =>
  Boolean(getShopPieceAsset(itemId, character));