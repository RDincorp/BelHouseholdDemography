export const SEMANTIC_COLORS = {
  // Total / General
  'всего': '#2563eb', // Blue
  'оба пола': '#2563eb',
  'итог': '#2563eb',
  'все население': '#2563eb',
  
  // Genders
  'мужчины': '#0284c7', // Sky Blue
  'женщины': '#e11d48', // Rose
  
  // Locations (Regions of Belarus)
  'г. минск': '#dc2626', // Red
  'минск': '#dc2626',
  'минская область': '#ea580c', // Orange
  'брестская область': '#16a34a', // Green
  'витебская область': '#7c3aed', // Violet
  'гомельская область': '#0891b2', // Cyan
  'гродненская область': '#ca8a04', // Yellow
  'могилевская область': '#c026d3', // Fuchsia
  
  // Types of settlement
  'городское': '#475569', // Slate
  'городское население': '#475569',
  'сельское': '#65a30d', // Lime
  'сельское население': '#65a30d',

  // Age groups
  'моложе трудоспособного': '#38bdf8', // Light Blue
  'в трудоспособном': '#4ade80', // Light Green
  'старше трудоспособного': '#94a3b8', // Gray
};

export const PALETTE = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', 
  '#f43f5e', '#6366f1', '#14b8a6', '#f97316', '#a855f7', '#0ea5e9',
  '#84cc16', '#ec4899', '#d946ef', '#f43f5e'
];

/**
 * Returns a consistent color for a given category name.
 * Uses predefined semantic colors if matched, otherwise generates a deterministic hash.
 */
export function getConstantColor(name) {
  if (!name) return PALETTE[0];
  
  const lowerName = name.toLowerCase().trim();
  
  // 1. Check semantic matching
  if (SEMANTIC_COLORS[lowerName]) {
    return SEMANTIC_COLORS[lowerName];
  }
  
  // Partial matches for genders if exact match fails
  if (lowerName.includes('мужчин')) return SEMANTIC_COLORS['мужчины'];
  if (lowerName.includes('женщин')) return SEMANTIC_COLORS['женщины'];
  if (lowerName.includes('оба пола')) return SEMANTIC_COLORS['оба пола'];
  
  // 2. Hash string for consistent fallback color
  let hash = 0;
  for (let i = 0; i < lowerName.length; i++) {
    hash = lowerName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}
