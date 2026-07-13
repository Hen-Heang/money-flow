// Shared category-matching rubric for LLM-based auto-categorization, used by both
// app/api/ai/suggest-category/route.ts (transaction form) and app/api/telegram/route.ts
// (chat-parsed expenses). Keeping this in one place avoids the two call sites' category
// judgment drifting apart — a bare "here are the category names" prompt reliably
// mis-tagged things like "Dinner" as "Utilities" since it had no anchor for what each
// category name actually means.
export const CATEGORY_MATCH_GUIDANCE = `Match based on the everyday, common-sense meaning of each category name, not just keyword overlap.
- Prefer the most specific matching category over a generic one when both exist (e.g. an "Electronics"/"Tech & Gadgets" category beats generic "Shopping" for a gadget purchase; "Food Delivery" beats generic "Food" for a delivery order).
- Meals, snacks, groceries, restaurants (breakfast, lunch, dinner, rice, meat, vegetables, snacks) belong to a food/dining category — never "Utilities" or "Housing".
- Coffee, tea, alcohol, and other drinks belong to a dedicated drink/cafe category if one exists; otherwise fall back to a food/dining category.
- Recurring digital services and subscriptions (streaming, Coupang Wow, server/hosting costs, software, memberships) belong to a subscription category if one exists.
- Physical gadgets, accessories, and one-off purchases (earphones, chargers, clothes) belong to a shopping or electronics category — not "Utilities".
- "Utilities" means recurring household bills only: electricity, water, gas, internet/phone bills, building maintenance fees — nothing else.
- If nothing fits well, prefer no match over forcing an unrelated category.`

export function formatCategoriesForPrompt(categories: Array<{ id: string; name: string; icon?: string | null }>) {
  return categories.map((c) => `${c.id}: ${c.name}${c.icon ? ` ${c.icon}` : ''}`).join('\n')
}
