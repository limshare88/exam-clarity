import { cn } from "@/lib/utils";
import chibiGirl from "@/assets/mascot-chibi-girl.png";
import longEar from "@/assets/mascot-long-ear.png";
import helperRobot from "@/assets/mascot-helper-robot.png";

type MascotProps = {
  hat?: string | null | undefined;
  outfit?: string | null | undefined;
  toy?: string | null | undefined;
  wallpaper?: string | null | undefined;
  mood?: "happy" | "cheer" | "calm";
  character?: string | null | undefined;
  className?: string;
};

const WALLPAPERS: Record<string, string> = {
  "bg-mint": "bg-mint",
  "bg-sunset": "bg-cream",
  "bg-night": "bg-lavender",
};

const CHARACTERS: Record<string, { src: string; name: string }> = {
  "mascot-chibi": { src: chibiGirl, name: "Mika, the chibi learner" },
  "mascot-long-ear": { src: longEar, name: "Mallow, the long-eared companion" },
  "mascot-robot": { src: helperRobot, name: "Pip, the helper robot" },
};

export function Mascot({ hat, outfit, toy, wallpaper, character, className }: MascotProps) {
  const selected = CHARACTERS[character ?? ""] ?? CHARACTERS["mascot-chibi"];
  return (
    <div
      className={cn(
        "relative flex h-72 w-full items-end justify-center overflow-hidden rounded-3xl border-2 border-border",
        WALLPAPERS[wallpaper ?? ""] ?? "bg-sky",
        className,
      )}
    >
      <div className="absolute left-5 top-5 text-2xl" aria-hidden>✦</div>
      <div className="absolute right-6 top-7 text-xl" aria-hidden>☁</div>

      <div className="relative h-[17rem] w-64" aria-label={selected.name} role="img">
        <img
          src={selected.src}
          alt=""
          width={768}
          height={1024}
          className="absolute inset-0 h-full w-full object-contain drop-shadow-lg"
        />
        {outfit && (
          <div className="absolute left-1/2 top-[55%] flex h-20 w-24 -translate-x-1/2 items-center justify-center rounded-[42%] border-2 border-border bg-secondary/90 text-4xl shadow-sm" aria-label="Equipped outfit">
            {outfit}
          </div>
        )}
        {hat && <div className="absolute left-1/2 top-1 -translate-x-1/2 text-6xl drop-shadow-md" aria-label="Equipped hat">{hat}</div>}
      </div>

      {toy && (
        <div className="absolute bottom-5 right-6 text-5xl drop-shadow-md" aria-label="Equipped desk toy">
          {toy}
        </div>
      )}
    </div>
  );
}
