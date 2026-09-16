function StudyRoomScene() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
      <defs>
        <linearGradient id="studyWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdf3e3" />
          <stop offset="100%" stopColor="#f6e3c4" />
        </linearGradient>
        <linearGradient id="studyFloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c98f5a" />
          <stop offset="100%" stopColor="#a8713e" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#studyWall)" />
      <rect y="252" width="400" height="48" fill="url(#studyFloor)" />

      {/* window with soft light */}
      <rect x="164" y="24" width="72" height="88" rx="6" fill="#bfe3f2" />
      <rect x="164" y="24" width="72" height="88" rx="6" fill="none" stroke="#8a6a3c" strokeWidth="5" />
      <line x1="200" y1="24" x2="200" y2="112" stroke="#8a6a3c" strokeWidth="4" />
      <line x1="164" y1="68" x2="236" y2="68" stroke="#8a6a3c" strokeWidth="4" />

      {/* left bookshelf */}
      <g>
        <rect x="10" y="40" width="90" height="212" rx="4" fill="#8a5a34" />
        <rect x="18" y="48" width="74" height="46" fill="#6f4526" />
        <rect x="18" y="102" width="74" height="46" fill="#6f4526" />
        <rect x="18" y="156" width="74" height="46" fill="#6f4526" />
        {[
          { x: 22, c: "#e8574a" },
          { x: 33, c: "#4fb3e8" },
          { x: 44, c: "#ffc93c" },
          { x: 55, c: "#4bc39c" },
          { x: 66, c: "#a389e0" },
          { x: 77, c: "#ff8fab" },
        ].map((b) => (
          <rect key={b.x} x={b.x} y={54} width="9" height="34" fill={b.c} />
        ))}
        {[
          { x: 22, c: "#ffc93c" },
          { x: 33, c: "#ff8fab" },
          { x: 44, c: "#4fb3e8" },
          { x: 55, c: "#e8574a" },
          { x: 66, c: "#4bc39c" },
          { x: 77, c: "#a389e0" },
        ].map((b) => (
          <rect key={`b2-${b.x}`} x={b.x} y={108} width="9" height="34" fill={b.c} />
        ))}
      </g>

      {/* right bookshelf */}
      <g>
        <rect x="300" y="40" width="90" height="212" rx="4" fill="#8a5a34" />
        <rect x="308" y="48" width="74" height="46" fill="#6f4526" />
        <rect x="308" y="102" width="74" height="46" fill="#6f4526" />
        <rect x="308" y="156" width="74" height="46" fill="#6f4526" />
        {[
          { x: 312, c: "#4bc39c" },
          { x: 323, c: "#ff8fab" },
          { x: 334, c: "#4fb3e8" },
          { x: 345, c: "#ffc93c" },
          { x: 356, c: "#e8574a" },
          { x: 367, c: "#a389e0" },
        ].map((b) => (
          <rect key={b.x} x={b.x} y={54} width="9" height="34" fill={b.c} />
        ))}
        {[
          { x: 312, c: "#a389e0" },
          { x: 323, c: "#4fb3e8" },
          { x: 334, c: "#ffc93c" },
          { x: 345, c: "#e8574a" },
          { x: 356, c: "#4bc39c" },
          { x: 367, c: "#ff8fab" },
        ].map((b) => (
          <rect key={`b2-${b.x}`} x={b.x} y={108} width="9" height="34" fill={b.c} />
        ))}
      </g>

      {/* rug */}
      <ellipse cx="200" cy="270" rx="130" ry="16" fill="#e08a4f" opacity="0.5" />
    </svg>
  );
}

function NightBedroomScene() {
  const stars = Array.from({ length: 26 }, (_, i) => ({
    x: (i * 37 + 13) % 400,
    y: (i * 53 + 8) % 190,
    r: (i % 3) + 1,
  }));
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
      <defs>
        <linearGradient id="nightSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#241b4d" />
          <stop offset="100%" stopColor="#3d2f74" />
        </linearGradient>
        <linearGradient id="nightFloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a3a7a" />
          <stop offset="100%" stopColor="#382a63" />
        </linearGradient>
        <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6d6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff6d6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#nightSky)" />
      <rect y="252" width="400" height="48" fill="url(#nightFloor)" />

      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff6d6" opacity="0.9" />
      ))}

      <circle cx="316" cy="66" r="50" fill="url(#moonGlow)" />
      <circle cx="316" cy="66" r="26" fill="#fff6d6" />
      <circle cx="306" cy="56" r="6" fill="#f2e6b8" opacity="0.7" />
      <circle cx="322" cy="76" r="4" fill="#f2e6b8" opacity="0.6" />

      {/* bed silhouette */}
      <rect x="30" y="196" width="140" height="56" rx="10" fill="#5a4590" />
      <rect x="30" y="176" width="24" height="76" rx="8" fill="#6a51a8" />
      <rect x="40" y="184" width="60" height="34" rx="8" fill="#8a72c9" />
      <rect x="30" y="230" width="140" height="14" fill="#4a3a7a" />

      {/* curtains at the edges */}
      <path d="M0 0 Q20 130 0 260 L0 0 Z" fill="#2e2260" opacity="0.7" />
      <path d="M400 0 Q380 130 400 260 L400 0 Z" fill="#2e2260" opacity="0.7" />
    </svg>
  );
}

function ClassroomScene() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
      <defs>
        <linearGradient id="classWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eaf6ff" />
          <stop offset="100%" stopColor="#d3ecfb" />
        </linearGradient>
        <linearGradient id="classFloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e3c99a" />
          <stop offset="100%" stopColor="#cdae74" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#classWall)" />
      <rect y="252" width="400" height="48" fill="url(#classFloor)" />

      {/* sunny window */}
      <circle cx="340" cy="46" r="26" fill="#ffe37a" opacity="0.9" />
      <rect x="290" y="20" width="70" height="70" rx="6" fill="#bfe3f2" opacity="0.5" />

      {/* blackboard */}
      <rect x="60" y="30" width="220" height="120" rx="8" fill="#2f5d4e" />
      <rect x="60" y="30" width="220" height="120" rx="8" fill="none" stroke="#8a5a34" strokeWidth="10" />
      <path d="M90 70 Q120 55 150 70" stroke="#eafff6" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
      <path d="M100 100 L100 130 M160 90 h60 M170 110 h40" stroke="#eafff6" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <rect x="70" y="150" width="60" height="8" rx="3" fill="#c9b98a" />

      {/* desk */}
      <rect x="140" y="210" width="140" height="14" fill="#8a5a34" />
      <rect x="150" y="224" width="12" height="40" fill="#6f4526" />
      <rect x="258" y="224" width="12" height="40" fill="#6f4526" />
      <rect x="160" y="196" width="90" height="16" rx="3" fill="#a8713e" />

      {/* apple on desk */}
      <circle cx="205" cy="192" r="10" fill="#e8574a" />
      <path d="M205 182 q4 -8 10 -6" stroke="#4bc39c" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const SCENES: Record<string, () => React.ReactElement> = {
  "bg-study": StudyRoomScene,
  "bg-night": NightBedroomScene,
  "bg-classroom": ClassroomScene,
};

// Illustrated photo-style backgrounds (as opposed to the flat SVG scenes above), loaded
// the same way ShopIcons.tsx loads wardrobe art. Keyed by item_id, e.g. "leo-bg-museum".
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
  "mascot-chibi-boy": "leo-bg-playground",
};

/** Renders the illustrated scene for a background item id: an image-based scene first,
 * then a flat SVG scene, then (if nothing is equipped) the equipping character's default
 * backdrop if it has one, else null for the plain colour fallback. */
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
  if (image) {
    return (
      <div className="absolute inset-0" aria-hidden>
        <img src={image} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  const Scene = SCENES[resolvedId];
  if (!Scene) return null;
  return (
    <div className="absolute inset-0" aria-hidden>
      <Scene />
    </div>
  );
}
