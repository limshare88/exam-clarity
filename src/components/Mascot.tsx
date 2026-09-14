import { cn } from "@/lib/utils";
import chibiGirl from "@/assets/mascot-chibi-girl.png";
import chibiBoy from "@/assets/mascot-chibi-boy.png";
import longEar from "@/assets/mascot-long-ear.png";
import helperRobot from "@/assets/mascot-helper-robot.png";
import { ShopIcon } from "@/components/ShopIcons";
import { BackgroundScene } from "@/components/BackgroundScenes";

type MascotProps = {
  /** Item id of the equipped hat, e.g. "hat-star". */
  hat?: string | null | undefined;
  /** Item id of the equipped outfit, e.g. "fit-hoodie". */
  outfit?: string | null | undefined;
  /** Item id of the equipped desk toy, e.g. "toy-cat". */
  toy?: string | null | undefined;
  /** Item id of the equipped background scene, e.g. "bg-study". */
  background?: string | null | undefined;
  mood?: "happy" | "cheer" | "calm";
  character?: string | null | undefined;
  className?: string;
};

const CHARACTERS: Record<string, { src: string; name: string }> = {
  "mascot-chibi": { src: chibiGirl, name: "Mika, the chibi learner" },
  "mascot-chibi-boy": { src: chibiBoy, name: "Leo, the chibi learner" },
  "mascot-long-ear": { src: longEar, name: "Mallow, the long-eared companion" },
  "mascot-robot": { src: helperRobot, name: "Pip, the helper robot" },
};
const DEFAULT_CHARACTER = { src: chibiGirl, name: "Mika, the chibi learner" };

export function Mascot({ hat, outfit, toy, background, character, className }: MascotProps) {
  const selected = CHARACTERS[character ?? ""] ?? DEFAULT_CHARACTER;
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
        {/* Equipped items render as the actual shop icon, positioned directly on the
            character, so what's equipped is what she sees worn — not a disconnected
            floating sticker. */}
        {outfit && (
          <ShopIcon
            itemId={outfit}
            className="absolute left-1/2 top-[54%] h-20 w-20 -translate-x-1/2 drop-shadow-md"
          />
        )}
        {hat && (
          <ShopIcon
            itemId={hat}
            className="absolute left-1/2 top-[-6%] h-24 w-24 -translate-x-1/2 drop-shadow-md"
          />
        )}
      </div>

      {toy && (
        <ShopIcon itemId={toy} className="absolute bottom-5 right-6 h-14 w-14 drop-shadow-md" />
      )}
    </div>
  );
}
