export const SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "English C1/C2",
] as const;

export type SubjectName = (typeof SUBJECTS)[number];

export const EXAM_BOARDS = [
  "Pearson Edexcel",
  "Cambridge CIE",
  "AQA",
  "OCR",
  "Cambridge C1 Advanced",
  "Cambridge C2 Proficiency",
  "IB",
  "Other",
];

export const LEARNING_PROFILES = ["Dyslexia", "Autism Spectrum", "ADHD"];

export const TIMER_OPTIONS = [
  { label: "45 seconds", value: 45 },
  { label: "1 minute", value: 60 },
  { label: "2 minutes", value: 120 },
  { label: "3 minutes", value: 180 },
];

export type SubjectBoard = { subject: string; board: string };

export const SHOP_ITEMS = [
  { item_id: "mascot-chibi", item_name: "Mika, Chibi Learner", category: "Mascots", price: 0, emoji: "🌸" },
  { item_id: "mascot-chibi-boy", item_name: "Leo, Chibi Learner", category: "Mascots", price: 0, emoji: "🌟" },
  { item_id: "mascot-long-ear", item_name: "Mallow, Long-Eared Friend", category: "Mascots", price: 180, emoji: "🌿" },
  { item_id: "mascot-robot", item_name: "Pip, Helper Robot", category: "Mascots", price: 240, emoji: "⚡" },
  { item_id: "hat-star", item_name: "Star Beret", category: "Hats", price: 40, emoji: "🎩" },
  { item_id: "hat-bunny", item_name: "Bunny Ears", category: "Hats", price: 60, emoji: "🐰" },
  { item_id: "hat-crown", item_name: "Pastel Crown", category: "Hats", price: 120, emoji: "👑" },
  { item_id: "fit-hoodie", item_name: "Mint Hoodie", category: "Outfits", price: 80, emoji: "🧥" },
  { item_id: "fit-sailor", item_name: "Lavender Uniform", category: "Outfits", price: 110, emoji: "👗" },
  { item_id: "fit-lab", item_name: "Science Lab Coat", category: "Outfits", price: 150, emoji: "🥼" },
  { item_id: "toy-cat", item_name: "Desk Cat", category: "Desk Toys", price: 50, emoji: "🐱" },
  { item_id: "toy-plant", item_name: "Tiny Plant", category: "Desk Toys", price: 35, emoji: "🪴" },
  { item_id: "toy-lamp", item_name: "Glow Lamp", category: "Desk Toys", price: 70, emoji: "💡" },
  { item_id: "bg-study", item_name: "Cozy Study Room", category: "Backgrounds", price: 90, emoji: "📚" },
  { item_id: "bg-night", item_name: "Starry Night Bedroom", category: "Backgrounds", price: 130, emoji: "🌙" },
  { item_id: "bg-classroom", item_name: "Bright Classroom", category: "Backgrounds", price: 110, emoji: "🏫" },
] as const;

export type ShopItem = (typeof SHOP_ITEMS)[number];

export function subjectStrategyRule(subject: string): string {
  const s = (subject || "").toLowerCase();
  if (s.includes("math") || s.includes("physics")) {
    return "You do NOT need to calculate the final numerical calculations.";
  }
  if (s.includes("chemistry") || s.includes("biology")) {
    return "You do NOT need to write out the full paragraph descriptions or raw data calculations.";
  }
  if (s.includes("english")) {
    return "You do NOT need to write out the full essay responses or complete text transforms.";
  }
  return "You do NOT need to write out the full final answer.";
}
