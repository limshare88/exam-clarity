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
  { item_id: "mascot-chibi", item_name: "Mika", emoji: "🌸" },
  { item_id: "mascot-chibi-boy", item_name: "Leo", emoji: "🌟" },
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
  { item_id: "mika-hair-braids", item_name: "Ribbon Twin Braids", category: "Hairstyles", price: 60, emoji: "🎀", avatar_id: "mascot-chibi", starter: false },
  { item_id: "mika-hair-bob", item_name: "Moonlight Bob", category: "Hairstyles", price: 70, emoji: "🌙", avatar_id: "mascot-chibi", starter: false },
  { item_id: "leo-hair-swoop", item_name: "Starlight Swoop", category: "Hairstyles", price: 60, emoji: "⭐", avatar_id: "mascot-chibi-boy", starter: false },
  { item_id: "leo-hair-curls", item_name: "Soft Cloud Curls", category: "Hairstyles", price: 70, emoji: "☁️", avatar_id: "mascot-chibi-boy", starter: false },
  { item_id: "mika-accessory-stars", item_name: "Star Hair Clips", category: "Accessories", price: 40, emoji: "🌟", avatar_id: "mascot-chibi", starter: false },
  { item_id: "mika-accessory-satchel", item_name: "Study Satchel", category: "Accessories", price: 65, emoji: "📚", avatar_id: "mascot-chibi", starter: false },
  { item_id: "leo-accessory-headphones", item_name: "Focus Headphones", category: "Accessories", price: 40, emoji: "🎧", avatar_id: "mascot-chibi-boy", starter: false },
  { item_id: "leo-accessory-backpack", item_name: "Explorer Backpack", category: "Accessories", price: 65, emoji: "🎒", avatar_id: "mascot-chibi-boy", starter: false },
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
