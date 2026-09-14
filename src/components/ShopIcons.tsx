import type { SVGProps } from "react";

/** Every icon shares one visual language — a soft drop shadow and a white gloss streak —
 * so the whole shop reads as one cohesive "sticker pack" instead of mismatched pieces. */
function Sticker({ children, ...props }: { children: React.ReactNode } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" {...props}>
      <defs>
        <filter id="stickerShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#000" floodOpacity="0.22" />
        </filter>
      </defs>
      <g filter="url(#stickerShadow)">{children}</g>
      {/* Gloss highlight, same on every icon */}
      <ellipse cx="34" cy="28" rx="16" ry="9" fill="#ffffff" opacity="0.5" transform="rotate(-25 34 28)" />
    </svg>
  );
}

function StarBeret(props: SVGProps<SVGSVGElement>) {
  return (
    <Sticker {...props}>
      <defs>
        <linearGradient id="beret" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff8fab" />
          <stop offset="100%" stopColor="#e94f78" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="62" rx="38" ry="22" fill="url(#beret)" />
      <ellipse cx="50" cy="48" rx="30" ry="24" fill="url(#beret)" />
      <circle cx="50" cy="26" r="7" fill="#ffd447" />
      <path d="M44 22 l6 -8 l6 8 l-6 4 z" fill="#ffd447" />
    </Sticker>
  );
}

function BunnyEars(props: SVGProps<SVGSVGElement>) {
  return (
    <Sticker {...props}>
      <defs>
        <linearGradient id="bunny" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f2dcea" />
        </linearGradient>
      </defs>
      <path d="M35 70 Q22 30 34 12 Q44 4 46 18 Q48 40 42 70 Z" fill="url(#bunny)" />
      <path d="M65 70 Q78 30 66 12 Q56 4 54 18 Q52 40 58 70 Z" fill="url(#bunny)" />
      <path d="M37 60 Q30 32 37 20 Q42 40 40 60 Z" fill="#ffb6cf" />
      <path d="M63 60 Q70 32 63 20 Q58 40 60 60 Z" fill="#ffb6cf" />
      <ellipse cx="50" cy="78" rx="22" ry="10" fill="#ff8fab" />
    </Sticker>
  );
}

function PastelCrown(props: SVGProps<SVGSVGElement>) {
  return (
    <Sticker {...props}>
      <defs>
        <linearGradient id="crown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe37a" />
          <stop offset="100%" stopColor="#ffc93c" />
        </linearGradient>
      </defs>
      <path d="M22 70 L26 34 L42 52 L50 26 L58 52 L74 34 L78 70 Z" fill="url(#crown)" />
      <rect x="22" y="68" width="56" height="10" rx="3" fill="url(#crown)" />
      <circle cx="26" cy="34" r="5" fill="#ff8fab" />
      <circle cx="50" cy="26" r="5" fill="#7dd3fc" />
      <circle cx="74" cy="34" r="5" fill="#ff8fab" />
    </Sticker>
  );
}

function MintHoodie(props: SVGProps<SVGSVGElement>) {
  return (
    <Sticker {...props}>
      <defs>
        <linearGradient id="hoodie" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fe3c7" />
          <stop offset="100%" stopColor="#4bc39c" />
        </linearGradient>
      </defs>
      <path d="M50 16 Q28 16 24 38 L20 78 L38 78 L40 54 Q50 62 60 54 L62 78 L80 78 L76 38 Q72 16 50 16 Z" fill="url(#hoodie)" />
      <circle cx="50" cy="34" r="14" fill="#eafff6" opacity="0.85" />
      <line x1="44" y1="46" x2="42" y2="66" stroke="#2f7a60" strokeWidth="3" strokeLinecap="round" />
      <line x1="56" y1="46" x2="58" y2="66" stroke="#2f7a60" strokeWidth="3" strokeLinecap="round" />
    </Sticker>
  );
}

function LavenderUniform(props: SVGProps<SVGSVGElement>) {
  return (
    <Sticker {...props}>
      <defs>
        <linearGradient id="uniform" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9b6f2" />
          <stop offset="100%" stopColor="#a389e0" />
        </linearGradient>
      </defs>
      <path d="M50 18 Q30 20 26 40 L22 80 L78 80 L74 40 Q70 20 50 18 Z" fill="url(#uniform)" />
      <path d="M38 24 L50 42 L62 24 L54 20 L50 30 L46 20 Z" fill="#ffffff" />
      <circle cx="50" cy="52" r="3" fill="#6a4fbf" />
      <circle cx="50" cy="62" r="3" fill="#6a4fbf" />
    </Sticker>
  );
}

function LabCoat(props: SVGProps<SVGSVGElement>) {
  return (
    <Sticker {...props}>
      <path d="M50 16 Q30 20 26 42 L20 80 L38 80 L40 46 L40 80 L60 80 L60 46 L62 80 L80 80 L74 42 Q70 20 50 16 Z" fill="#f5f7fb" />
      <path d="M38 22 L50 40 L62 22 L56 18 L50 28 L44 18 Z" fill="#dbe3f0" />
      <rect x="42" y="52" width="16" height="12" rx="2" fill="#dbe3f0" />
      <circle cx="46" cy="46" r="2.2" fill="#a9b6cc" />
      <circle cx="46" cy="66" r="2.2" fill="#a9b6cc" />
    </Sticker>
  );
}

function DeskCat(props: SVGProps<SVGSVGElement>) {
  return (
    <Sticker {...props}>
      <defs>
        <linearGradient id="cat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffc98a" />
          <stop offset="100%" stopColor="#f5a555" />
        </linearGradient>
      </defs>
      <path d="M30 78 Q24 50 34 40 L28 24 L44 34 Q56 30 66 34 L72 22 L68 40 Q78 50 72 78 Z" fill="url(#cat)" />
      <path d="M40 52 Q50 60 60 52" stroke="#7a4a20" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="40" cy="46" r="3.5" fill="#3a2a1a" />
      <circle cx="60" cy="46" r="3.5" fill="#3a2a1a" />
      <path d="M72 60 Q88 58 86 44" stroke="#f5a555" strokeWidth="7" fill="none" strokeLinecap="round" />
    </Sticker>
  );
}

function TinyPlant(props: SVGProps<SVGSVGElement>) {
  return (
    <Sticker {...props}>
      <defs>
        <linearGradient id="pot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2895a" />
          <stop offset="100%" stopColor="#c76a3d" />
        </linearGradient>
        <linearGradient id="leaf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fe38f" />
          <stop offset="100%" stopColor="#4ba84b" />
        </linearGradient>
      </defs>
      <path d="M34 62 L66 62 L60 84 L40 84 Z" fill="url(#pot)" />
      <path d="M50 62 Q30 44 36 22 Q52 30 50 62 Z" fill="url(#leaf)" />
      <path d="M50 62 Q70 44 64 22 Q48 30 50 62 Z" fill="url(#leaf)" />
      <path d="M50 62 Q50 30 50 16" stroke="#3a7a3a" strokeWidth="3" fill="none" strokeLinecap="round" />
    </Sticker>
  );
}

function GlowLamp(props: SVGProps<SVGSVGElement>) {
  return (
    <Sticker {...props}>
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff3b0" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fff3b0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lampBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#4fb3e8" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="38" r="30" fill="url(#glow)" />
      <circle cx="50" cy="38" r="14" fill="#ffe37a" />
      <path d="M50 52 L50 70" stroke="url(#lampBody)" strokeWidth="6" strokeLinecap="round" />
      <path d="M32 82 Q50 68 68 82" stroke="url(#lampBody)" strokeWidth="6" fill="none" strokeLinecap="round" />
    </Sticker>
  );
}

type WearableKind = "dress" | "jacket" | "coat" | "hair" | "clips" | "bag" | "headphones";

function PremiumWearable({ kind, tone, accent, ...props }: SVGProps<SVGSVGElement> & { kind: WearableKind; tone: string; accent: string }) {
  const id = `wear-${kind}-${tone.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <Sticker {...props}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="48%" stopColor={tone} />
          <stop offset="100%" stopColor={tone} stopOpacity="0.72" />
        </linearGradient>
      </defs>
      {(kind === "dress" || kind === "jacket" || kind === "coat") && (
        <g>
          <path d="M50 14 C34 14 28 23 27 38 L20 79 C29 84 39 87 50 87 C61 87 71 84 80 79 L73 38 C72 23 66 14 50 14Z" fill={`url(#${id})`} stroke={accent} strokeWidth="2" />
          {kind === "dress" && <path d="M34 50 L22 82 Q50 94 78 82 L66 50Z" fill={`url(#${id})`} />}
          {kind === "jacket" && <path d="M50 20 V82 M31 35 L18 67 M69 35 L82 67" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />}
          {kind === "coat" && <path d="M38 18 L50 38 L62 18 M50 38 V84" fill="none" stroke="#f8fbff" strokeWidth="5" strokeLinecap="round" />}
          <path d="M34 23 Q50 34 66 23" fill="none" stroke="#ffffff" strokeOpacity="0.72" strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="51" r="3" fill={accent} />
          <circle cx="50" cy="63" r="3" fill={accent} />
        </g>
      )}
      {kind === "hair" && (
        <g fill={`url(#${id})`} stroke={tone} strokeWidth="2">
          <path d="M18 62 Q12 18 50 10 Q88 18 82 62 Q72 38 62 31 Q49 45 22 46Z" />
          <path d="M24 44 Q15 72 28 91 Q39 70 38 48Z" />
          <path d="M76 44 Q85 72 72 91 Q61 70 62 48Z" />
          <path d="M29 34 Q44 14 70 25" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
      {kind === "clips" && <g fill={`url(#${id})`}><path d="M28 55 l5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1Z" /><path d="M72 55 l5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1Z" /></g>}
      {kind === "bag" && <g><rect x="22" y="32" width="56" height="52" rx="14" fill={`url(#${id})`} stroke={accent} strokeWidth="3" /><path d="M35 35 Q50 11 65 35" fill="none" stroke={accent} strokeWidth="6" /><path d="M35 58 H65" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="4" strokeLinecap="round" /></g>}
      {kind === "headphones" && <g fill="none" stroke={`url(#${id})`} strokeLinecap="round"><path d="M22 58 Q22 16 50 16 Q78 16 78 58" strokeWidth="10" /><rect x="13" y="51" width="20" height="33" rx="9" fill={tone} stroke={accent} strokeWidth="3" /><rect x="67" y="51" width="20" height="33" rx="9" fill={tone} stroke={accent} strokeWidth="3" /></g>}
    </Sticker>
  );
}

const wearable = (kind: WearableKind, tone: string, accent: string) =>
  (props: SVGProps<SVGSVGElement>) => <PremiumWearable {...props} kind={kind} tone={tone} accent={accent} />;

const ICONS: Record<string, (props: SVGProps<SVGSVGElement>) => React.ReactElement> = {
  "hat-star": StarBeret,
  "hat-bunny": BunnyEars,
  "hat-crown": PastelCrown,
  "fit-hoodie": MintHoodie,
  "fit-sailor": LavenderUniform,
  "fit-lab": LabCoat,
  "toy-cat": DeskCat,
  "toy-plant": TinyPlant,
  "toy-lamp": GlowLamp,
  "mika-outfit-cloud": wearable("dress", "#9cd9ef", "#fff4a8"),
  "mika-outfit-sailor": wearable("dress", "#b6a2e7", "#fff7ff"),
  "leo-outfit-sky": wearable("jacket", "#73bce4", "#e9fbff"),
  "leo-outfit-varsity": wearable("jacket", "#72c6a5", "#f5fff9"),
  "mika-outfit-starlight": wearable("dress", "#df83b8", "#ffe37a"),
  "mika-outfit-lab": wearable("coat", "#e8f3fa", "#8ac7dc"),
  "leo-outfit-cosmic": wearable("jacket", "#665fb8", "#89d8ef"),
  "leo-outfit-lab": wearable("coat", "#e8f3fa", "#67b5d2"),
  "mika-hair-braids": wearable("hair", "#70442f", "#d79573"),
  "mika-hair-bob": wearable("hair", "#57405e", "#a68bb0"),
  "leo-hair-swoop": wearable("hair", "#815039", "#d79a72"),
  "leo-hair-curls": wearable("hair", "#5c463c", "#b58b74"),
  "mika-accessory-stars": wearable("clips", "#ef9dbd", "#ffe377"),
  "mika-accessory-satchel": wearable("bag", "#bd7f58", "#74472f"),
  "leo-accessory-headphones": wearable("headphones", "#67b9d5", "#376f92"),
  "leo-accessory-backpack": wearable("bag", "#6dad93", "#376d5d"),
};

/** Renders the glossy sticker icon for a shop item id, or null if this item (e.g. a
 * mascot or background, which render their own preview elsewhere) has no icon here. */
export function ShopIcon({ itemId, className }: { itemId: string; className?: string }) {
  const Icon = ICONS[itemId];
  if (!Icon) return null;
  return <Icon className={className} />;
}

export const HAS_SHOP_ICON = (itemId: string): boolean => itemId in ICONS;
