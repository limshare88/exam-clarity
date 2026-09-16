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

export const CHILD_AVATARS = [
  { item_id: "mascot-chibi", item_name: "Mika", emoji: "🌸", price: 0 },
  { item_id: "mascot-chibi-boy", item_name: "Leo", emoji: "🌟", price: 0 },
  { item_id: "mascot-long-ear", item_name: "Mallow", emoji: "🐰", price: 150 },
  { item_id: "mascot-robot", item_name: "Pip", emoji: "🤖", price: 150 },
] as const;

export const SHOP_ITEMS = [
  { item_id: "mika-outfit-cloud", item_name: "Cloud Day Dress", category: "Outfits", price: 0, emoji: "☁️", avatar_id: "mascot-chibi", starter: true },
  { item_id: "mika-outfit-sailor", item_name: "Lavender Sailor Set", category: "Outfits", price: 0, emoji: "💜", avatar_id: "mascot-chibi", starter: true },
  { item_id: "leo-outfit-sky", item_name: "Sky Explorer Set", category: "Outfits", price: 0, emoji: "🩵", avatar_id: "mascot-chibi-boy", starter: true },
  { item_id: "leo-outfit-varsity", item_name: "Mint Varsity Set", category: "Outfits", price: 0, emoji: "🌿", avatar_id: "mascot-chibi-boy", starter: true },
  { item_id: "mika-outfit-starlight", item_name: "Starlight Party Dress", category: "Outfits", price: 50, emoji: "✨", avatar_id: "mascot-chibi", starter: false },
  { item_id: "mika-outfit-lab", item_name: "Mika Science Coat", category: "Outfits", price: 80, emoji: "🧪", avatar_id: "mascot-chibi", starter: false },
  { item_id: "leo-outfit-cosmic", item_name: "Cosmic Adventure Set", category: "Outfits", price: 50, emoji: "🚀", avatar_id: "mascot-chibi-boy", starter: false },
  { item_id: "leo-outfit-lab", item_name: "Leo Science Coat", category: "Outfits", price: 80, emoji: "🔬", avatar_id: "mascot-chibi-boy", starter: false },
  { item_id: "mallow-outfit-stargazer", item_name: "Stargazer Cape", category: "Outfits", price: 50, emoji: "🌙", avatar_id: "mascot-long-ear", starter: false },
  { item_id: "mallow-outfit-scholar", item_name: "Scholar Mantle", category: "Outfits", price: 80, emoji: "📖", avatar_id: "mascot-long-ear", starter: false },
  { item_id: "pip-outfit-explorer", item_name: "Explorer Shell", category: "Outfits", price: 50, emoji: "🧭", avatar_id: "mascot-robot", starter: false },
  { item_id: "pip-outfit-science", item_name: "Science Shell", category: "Outfits", price: 80, emoji: "⚗️", avatar_id: "mascot-robot", starter: false },
  { item_id: "mika-accessory-stars", item_name: "Star Hair Clips", category: "Accessories", price: 40, emoji: "🌟", avatar_id: "mascot-chibi", starter: false },
  { item_id: "mika-accessory-satchel", item_name: "Study Satchel", category: "Accessories", price: 65, emoji: "📚", avatar_id: "mascot-chibi", starter: false },
  { item_id: "leo-accessory-headphones", item_name: "Focus Headphones", category: "Accessories", price: 40, emoji: "🎧", avatar_id: "mascot-chibi-boy", starter: false },
  { item_id: "leo-accessory-backpack", item_name: "Explorer Backpack", category: "Accessories", price: 65, emoji: "🎒", avatar_id: "mascot-chibi-boy", starter: false },
  { item_id: "mallow-accessory-moon", item_name: "Moon Charm Collar", category: "Accessories", price: 40, emoji: "🌙", avatar_id: "mascot-long-ear", starter: false },
  { item_id: "mallow-accessory-books", item_name: "Book Satchel Harness", category: "Accessories", price: 65, emoji: "📚", avatar_id: "mascot-long-ear", starter: false },
  { item_id: "pip-accessory-signals", item_name: "Signal Light Charms", category: "Accessories", price: 40, emoji: "🚦", avatar_id: "mascot-robot", starter: false },
  { item_id: "pip-accessory-tools", item_name: "Tool Backpack Module", category: "Accessories", price: 65, emoji: "🛠️", avatar_id: "mascot-robot", starter: false },
  { item_id: "hat-star", item_name: "Star Beret", category: "Hats", price: 40, emoji: "🎩", avatar_id: "mascot-chibi" },
  { item_id: "hat-bunny", item_name: "Bunny Ears", category: "Hats", price: 60, emoji: "🐰", avatar_id: "mascot-chibi" },
  { item_id: "hat-crown", item_name: "Pastel Crown", category: "Hats", price: 120, emoji: "👑", avatar_id: "mascot-chibi" },
  { item_id: "hat-cap", item_name: "Backwards Cap", category: "Hats", price: 40, emoji: "🧢", avatar_id: "mascot-chibi-boy" },
  { item_id: "hat-beanie", item_name: "Cozy Beanie", category: "Hats", price: 60, emoji: "🥶", avatar_id: "mascot-chibi-boy" },
  { item_id: "hat-explorer", item_name: "Explorer Hat", category: "Hats", price: 120, emoji: "🧭", avatar_id: "mascot-chibi-boy" },
  { item_id: "fit-hoodie", item_name: "Mint Hoodie", category: "Outfits", price: 80, emoji: "🧥" },
  { item_id: "fit-sailor", item_name: "Lavender Uniform", category: "Outfits", price: 110, emoji: "👗" },
  { item_id: "fit-lab", item_name: "Science Lab Coat", category: "Outfits", price: 150, emoji: "🥼" },
  { item_id: "toy-cat", item_name: "Desk Cat", category: "Desk Toys", price: 50, emoji: "🐱" },
  { item_id: "toy-plant", item_name: "Tiny Plant", category: "Desk Toys", price: 35, emoji: "🪴" },
  { item_id: "toy-lamp", item_name: "Glow Lamp", category: "Desk Toys", price: 70, emoji: "💡" },
  { item_id: "leo-bg-study", item_name: "Study Room", category: "Backgrounds", price: 90, emoji: "📖", avatar_id: "mascot-chibi-boy" },
  { item_id: "leo-bg-cafe", item_name: "Cosy Cafe", category: "Backgrounds", price: 100, emoji: "☕", avatar_id: "mascot-chibi-boy" },
  { item_id: "leo-bg-lab", item_name: "Science Lab", category: "Backgrounds", price: 120, emoji: "🧪", avatar_id: "mascot-chibi-boy" },
  { item_id: "leo-bg-museum", item_name: "Dinosaur Museum", category: "Backgrounds", price: 140, emoji: "🦖", avatar_id: "mascot-chibi-boy" },
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
