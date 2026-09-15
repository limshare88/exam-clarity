import { cn } from "@/lib/utils";
import chibiGirlAsset from "@/assets/mascot-chibi-girl.png.asset.json";
import chibiBoyAsset from "@/assets/mascot-chibi-boy.png.asset.json";
import longEarAsset from "@/assets/mascot-long-ear.png.asset.json";
import helperRobotAsset from "@/assets/mascot-helper-robot.png.asset.json";
import { getMascotCompositeAsset, ShopIcon } from "@/components/ShopIcons";
import { BackgroundScene } from "@/components/BackgroundScenes";

type MascotProps = {
  /** Item id of the equipped hat, e.g. "hat-star". */
  hat?: string | null | undefined;
  /** Item id of the equipped outfit, e.g. "fit-hoodie". */
  outfit?: string | null | undefined;
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

export function Mascot({ hat, outfit, accessory, toy, background, character, className }: MascotProps) {
  const selected = CHARACTERS[character ?? ""] ?? DEFAULT_CHARACTER;
  const outfitComposite = getMascotCompositeAsset(outfit, character);
  const hatLayer = getMascotCompositeAsset(hat, character);
  const accessoryLayer = getMascotCompositeAsset(accessory, character);
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
          src={outfitComposite ?? selected.src}
          alt=""
          width={768}
          height={1024}
          className="absolute inset-0 h-full w-full object-contain drop-shadow-lg"
        />
        {hatLayer && <img src={hatLayer} alt="" width={768} height={1024} className="pointer-events-none absolute inset-0 h-full w-full object-contain drop-shadow-md" />}
        {accessoryLayer && <img src={accessoryLayer} alt="" width={768} height={1024} className="pointer-events-none absolute inset-0 h-full w-full object-contain drop-shadow-md" />}
      </div>

      {toy && (
        <ShopIcon itemId={toy} character={character} className="absolute bottom-5 right-6 h-20 w-20 drop-shadow-md" />
      )}
    </div>
  );
}
