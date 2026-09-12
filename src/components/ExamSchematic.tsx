export type SchematicKind =
  | "force"
  | "circuit"
  | "wave"
  | "rays"
  | "apparatus"
  | "bonding"
  | "plant_cell"
  | "cell_division"
  | "organ"
  | "function_graph"
  | "integration_area"
  | "trig_graph"
  | "geometry"
  | "circle_theorem";

export type ExamSchematicData = {
  kind: SchematicKind;
  title: string;
  labels: string[];
  variant: string;
  values: number[];
};

type Props = { diagram: ExamSchematicData; subject: string };

const line = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const thin = { ...line, strokeWidth: 1.5 };

function label(labels: string[], index: number, fallback: string) {
  return labels[index]?.slice(0, 24) || fallback;
}

function Axes({ grid = true }: { grid?: boolean }) {
  return (
    <>
      {grid && [55, 85, 115, 145, 175, 205, 235, 265].map((x) => <line key={`x${x}`} x1={x} y1="25" x2={x} y2="185" {...thin} opacity="0.25" />)}
      {grid && [45, 75, 105, 135, 165].map((y) => <line key={`y${y}`} x1="35" y1={y} x2="285" y2={y} {...thin} opacity="0.25" />)}
      <path d="M35 165H287M55 188V20" {...line} />
      <path d="m287 165-10-5v10zM55 20l-5 10h10z" fill="currentColor" />
      <text x="276" y="184">x</text><text x="38" y="32">y</text><text x="40" y="183">0</text>
    </>
  );
}

function Diagram({ diagram }: { diagram: ExamSchematicData }) {
  const a = label(diagram.labels, 0, "A");
  const b = label(diagram.labels, 1, "B");
  switch (diagram.kind) {
    case "force": return <><rect x="120" y="75" width="80" height="60" {...line}/><path d="M160 75V24m0 0-7 12m7-12 7 12M160 135v50m0 0-7-12m7 12 7-12M120 105H55m0 0 13-7m-13 7 13 7M200 105h65m0 0-13-7m13 7-13 7" {...line}/><text x="170" y="35">{a}</text><text x="170" y="181">{b}</text></>;
    case "circuit": return <><path d="M55 50H265V160H55ZM145 50v22m30-22v22M145 61h-35m100 0h-35" {...line}/><circle cx="55" cy="105" r="18" {...line}/><path d="M45 95l20 20m0-20-20 20" {...line}/><circle cx="265" cy="105" r="18" {...line}/><text x="258" y="111">A</text><text x="126" y="38">{a}</text></>;
    case "wave": return <><Axes/><path d="M55 105C75 45 105 45 125 105s50 60 70 0 50-60 70 0" {...line}/><path d="M75 48v57m-5-50 5-10 5 10M70 98l5 10 5-10" {...thin}/><text x="82" y="70">{a}</text></>;
    case "rays": return <><path d="M150 35l55 130H95z" {...line}/><path d="M35 88h90l48 32 105-48M35 105h87l50 25 106-20" {...line}/><text x="105" y="182">{a}</text><text x="220" y="62">{b}</text></>;
    case "apparatus": return <><path d="M62 35v90c0 37 68 37 68 0V35M62 35h68M96 145v25m-30 0h60" {...line}/><path d="M130 75h65v25m0 0c0 24 50 24 50 0V60m-18 0h36" {...line}/><path d="M72 112h48M202 100h36" {...thin}/><text x="54" y="190">{a}</text><text x="190" y="145">{b}</text></>;
    case "bonding": return <><circle cx="125" cy="105" r="45" {...line}/><circle cx="195" cy="105" r="45" {...line}/><text x="102" y="111">{a}</text><text x="207" y="111">{b}</text><circle cx="155" cy="95" r="4" fill="currentColor"/><path d="m163 111 8 8m0-8-8 8" {...thin}/></>;
    case "plant_cell": return <><path d="M55 45Q45 105 55 165Q160 185 265 165Q275 105 265 45Q160 25 55 45Z" {...line}/><path d="M70 58Q62 105 70 150Q160 166 250 150Q258 105 250 58Q160 42 70 58Z" {...thin}/><circle cx="115" cy="105" r="22" {...line}/><ellipse cx="190" cy="104" rx="42" ry="30" {...line}/><path d="M230 48l-25 32M78 45l24 42" {...thin}/><text x="228" y="40">{a}</text></>;
    case "cell_division": return <><circle cx="80" cy="105" r="42" {...line}/><path d="m66 88 28 34m0-34-28 34" {...line}/><path d="M130 105h52m0 0-12-7m12 7-12 7" {...line}/><circle cx="230" cy="75" r="28" {...line}/><circle cx="230" cy="137" r="28" {...line}/><text x="45" y="170">{a}</text></>;
    case "organ": return <><path d="M160 45c-35-38-85 2-65 48 15 35 65 73 65 73s50-38 65-73c20-46-30-86-65-48Z" {...line}/><path d="M160 45v121M95 82h130" {...thin}/><path d="M225 82h42m0 0-12-7m12 7-12 7" {...line}/><text x="220" y="65">{a}</text></>;
    case "function_graph": return <><Axes/><path d={diagram.variant.includes("cubic") ? "M65 155C110 155 105 55 155 105s45-50 120-50" : diagram.variant.includes("exponential") ? "M60 155C140 155 205 130 275 35" : "M65 45Q160 195 275 45"} {...line}/><text x="225" y="50">{a}</text></>;
    case "integration_area": return <><Axes/><path d="M65 145Q155 35 265 65" {...line}/><path d="M95 165V116Q155 48 225 72V165Z" fill="currentColor" opacity="0.14" stroke="currentColor" strokeWidth="2"/><text x="132" y="132">{a}</text></>;
    case "trig_graph": return <><Axes/><path d={diagram.variant.includes("cos") ? "M55 55C85 55 85 155 115 155s30-100 60-100 30 100 60 100 30-100 50-100" : "M55 105c30-68 60-68 90 0s60 68 90 0 40-62 50-35"} {...line}/><text x="205" y="48">{a}</text></>;
    case "geometry": return <><path d="M70 160 160 35l95 125Z" {...line}/><path d="M140 160a28 28 0 0 1 15-25" {...thin}/><text x="135" y="151">{a}</text><text x="157" y="29">{b}</text></>;
    case "circle_theorem": return <><circle cx="160" cy="105" r="75" {...line}/><path d="M100 150 160 30l65 105-125 15Z" {...line}/><path d="M145 59a30 30 0 0 1 31 0" {...thin}/><text x="151" y="68">{a}</text></>;
  }
}

export function ExamSchematic({ diagram, subject }: Props) {
  return (
    <figure className="overflow-hidden rounded-2xl border-2 border-schematic-ink bg-schematic-paper p-3 text-schematic-ink">
      <figcaption className="mb-2 text-center text-sm font-bold">{diagram.title || `${subject} exam schematic`}</figcaption>
      <svg viewBox="0 0 320 210" role="img" aria-label={`${subject}: ${diagram.title}`} className="schematic-labels mx-auto block w-full max-w-xl bg-schematic-paper font-sans text-schematic-ink">
        <Diagram diagram={diagram} />
      </svg>
    </figure>
  );
}