import { cn } from "@/lib/utils";

type MascotProps = {
  hat?: string | null;
  outfit?: string | null;
  toy?: string | null;
  wallpaper?: string | null;
  mood?: "happy" | "cheer" | "calm";
  className?: string;
};

const WALLPAPERS: Record<string, string> = {
  "bg-mint": "bg-mint",
  "bg-sunset": "bg-cream",
  "bg-night": "bg-lavender",
};

export function Mascot({ hat, outfit, toy, wallpaper, mood = "happy", className }: MascotProps) {
  return (
    <div
      className={cn(
        "relative flex h-52 w-full items-end justify-center overflow-hidden rounded-3xl border-2 border-border",
        WALLPAPERS[wallpaper ?? ""] ?? "bg-sky",
        className,
      )}
    >
      <div className="absolute left-4 top-4 text-3xl">✨</div>
      <div className="absolute right-5 top-6 text-2xl">☁️</div>

      <div className="relative mb-4 flex flex-col items-center">
        {hat && <div className="mb-[-14px] text-4xl">{hat}</div>}
        {/* head */}
        <div className="relative flex h-24 w-24 items-center justify-center rounded-[45%] border-2 border-border bg-cream">
          <div className="absolute left-5 top-9 h-3 w-3 rounded-full bg-foreground" />
          <div className="absolute right-5 top-9 h-3 w-3 rounded-full bg-foreground" />
          <div className="absolute left-3 top-12 h-2.5 w-4 rounded-full bg-peach opacity-80" />
          <div className="absolute right-3 top-12 h-2.5 w-4 rounded-full bg-peach opacity-80" />
          <div className="absolute bottom-5 text-lg leading-none">
            {mood === "cheer" ? "▽" : mood === "calm" ? "‿" : "ω"}
          </div>
        </div>
        {/* body */}
        <div className="-mt-2 flex h-20 w-24 items-center justify-center rounded-t-3xl border-2 border-border bg-secondary text-2xl">
          {outfit ?? "🎀"}
        </div>
      </div>

      {toy && (
        <div className="absolute bottom-4 right-5 text-3xl" aria-hidden>
          {toy}
        </div>
      )}
    </div>
  );
}
