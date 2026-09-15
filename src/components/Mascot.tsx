import { cn } from "@/lib/utils";
import chibiGirlAsset from "@/assets/mascot-chibi-girl.png.asset.json";
import chibiBoyAsset from "@/assets/mascot-chibi-boy.png.asset.json";
import longEarAsset from "@/assets/mascot-long-ear.png.asset.json";
import helperRobotAsset from "@/assets/mascot-helper-robot.png.asset.json";
import { ShopIcon } from "@/components/ShopIcons";
import { BackgroundScene } from "@/components/BackgroundScenes";

type MascotProps = {
  /** Item id of the equipped hat, e.g. "hat-star". */
  hat?: string | null | undefined;
  /** Item id of the equipped outfit, e.g. "fit-hoodie". */
  outfit?: string | null | undefined;
  hairstyle?: string | null | undefined;
  accessory?: string | null | undefined;
  /** Item id of the equipped desk toy, e.g. "toy-cat". */
  toy?: string | null | undefined;
  /** Item id of the equipped background scene, e.g. "bg-study". */
  background?: string | null | undefined;
  mood?: "happy" | "cheer" | "calm";
  character?: string | null | undefined;
  className?: string;
};

const CHARACTERS: Record<string, { src: string; name: string }> = {
  "mascot-chibi": { src: chibiGirlAsset.url, name: "Mika, the chibi learner" },
  "mascot-chibi-boy": { src: chibiBoyAsset.url, name: "Leo, the chibi learner" },
  "mascot-long-ear": { src: longEarAsset.url, name: "Mallow, the long-eared companion" },
  "mascot-robot": { src: helperRobotAsset.url, name: "Pip, the helper robot" },
};
const DEFAULT_CHARACTER = { src: chibiGirlAsset.url, name: "Mika, the chibi learner" };

type EquipLayout = {
  hairstyle: string;
  outfit: string;
  hat: string;
  accessory: string;
};

// Equipped hats/outfits/hairstyles/accessories render as flat icons positioned directly on
// top of the character art. That only lines up when the position is calibrated to each
// character's own proportions -- a single shared set of coordinates works by coincidence
// for whichever character it was tuned against and drifts for anyone drawn at a different
// scale or head/torso ratio (this is what went wrong for Leo after his art was redrawn).
// DEFAULT_LAYOUT is that original tuning; per-character entries in LAYOUT_OVERRIDES adjust
// individual pieces for a character whose proportions differ, without needing to redefine
// pieces that already fit.
const DEFAULT_LAYOUT: EquipLayout = {
  hairstyle: "absolute left-1/2 top-[-2%] h-[42%] w-[88%] -translate-x-1/2 drop-shadow-md",
  outfit: "absolute left-1/2 top-[54%] h-20 w-20 -translate-x-1/2 drop-shadow-md",
  hat: "absolute left-1/2 top-[-6%] h-24 w-24 -translate-x-1/2 drop-shadow-md",
  accessory: "absolute bottom-[16%] right-[-18%] h-20 w-20 drop-shadow-md",
};

// Leo's redesigned art is a noticeably slimmer, narrower build than the proportions
// DEFAULT_LAYOUT was tuned against, so the same fixed icon sizes/positions overshoot his
// actual head and torso -- this is a reasoned first-pass correction (smaller hat sitting
// closer to his head, outfit icon moved up over his chest instead of his waist and sized
// down to fit his narrower frame), not a pixel-measured one; it may still need a round of
// adjustment against a fresh screenshot once it's live.
const LAYOUT_OVERRIDES: Record<string, Partial<EquipLayout>> = {
  "mascot-chibi-boy": {
    hat: "absolute left-1/2 top-[-3%] h-16 w-16 -translate-x-1/2 drop-shadow-md",
    outfit: "absolute left-1/2 top-[40%] h-14 w-14 -translate-x-1/2 drop-shadow-md",
  },
};

function layoutFor(character: string | null | undefined): EquipLayout {
  return { ...DEFAULT_LAYOUT, ...(LAYOUT_OVERRIDES[character ?? ""] ?? {}) };
}

export function Mascot({ hat, outfit, hairstyle, accessory, toy, background, character, className }: MascotProps) {
  const selected = CHARACTERS[character ?? ""] ?? DEFAULT_CHARACTER;
  const layout = layoutFor(character);
  return (
    <div
      className={cn(
        "relative flex h-72 w-full items-end justify-center overflow-hidden rounded-3xl border-2 border-border bg-sky",
        className,
      )}
    >
      <BackgroundScene itemId={background} />

      <div className="relative aspect-[3/4] h-[85%]" aria-label={selected.name} role="img">
        <img
          src={selected.src}
          alt=""
          width={768}
          height={1024}
          className="absolute inset-0 h-full w-full object-contain drop-shadow-lg"
        />
        {hairstyle && <ShopIcon itemId={hairstyle} className={layout.hairstyle} />}
        {/* Equipped items render as the actual shop icon, positioned directly on the
            character, so what's equipped is what she sees worn — not a disconnected
            floating sticker. */}
        {outfit && <ShopIcon itemId={outfit} className={layout.outfit} />}
        {hat && <ShopIcon itemId={hat} className={layout.hat} />}
        {accessory && <ShopIcon itemId={accessory} className={layout.accessory} />}
      </div>

      {toy && (
        <ShopIcon itemId={toy} className="absolute bottom-5 right-6 h-14 w-14 drop-shadow-md" />
      )}
    </div>
  );
}
