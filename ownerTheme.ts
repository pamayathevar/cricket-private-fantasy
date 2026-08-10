export type OwnerTheme = {
  accent: string;
  strong: string;
  soft: string;
  border: string;
  onAccent: string;
};

const OWNER_THEMES: Record<string, OwnerTheme> = {
  pandiyan: { accent: "#6D44C5", strong: "#4D2A91", soft: "#F1EAFF", border: "#BBA5E8", onAccent: "#FFFFFF" },
  saravana: { accent: "#2878C8", strong: "#17528E", soft: "#E7F2FF", border: "#91BDE8", onAccent: "#FFFFFF" },
  sashi: { accent: "#148A83", strong: "#08645F", soft: "#E2F5F2", border: "#83C9C3", onAccent: "#FFFFFF" },
  jeba: { accent: "#E47528", strong: "#A84A0B", soft: "#FFF0E3", border: "#EFB17F", onAccent: "#FFFFFF" },
  johny: { accent: "#4F61C8", strong: "#34439A", soft: "#ECEEFF", border: "#A7B0EB", onAccent: "#FFFFFF" },
  tamil: { accent: "#C33B83", strong: "#8B245B", soft: "#FCE8F3", border: "#E49BC1", onAccent: "#FFFFFF" },
  murali: { accent: "#338A4E", strong: "#216437", soft: "#E5F4E9", border: "#94C8A2", onAccent: "#FFFFFF" },
  mansur: { accent: "#A25C38", strong: "#743C22", soft: "#F8EDE6", border: "#D4A184", onAccent: "#FFFFFF" },
  bala: { accent: "#C54A4A", strong: "#8F3030", soft: "#FBEAEA", border: "#E29B9B", onAccent: "#FFFFFF" },
  "test owner": { accent: "#607386", strong: "#405263", soft: "#EAF0F4", border: "#A8B6C2", onAccent: "#FFFFFF" },
};

const FALLBACK_THEMES: OwnerTheme[] = [
  { accent: "#7B58A6", strong: "#573B79", soft: "#F2EBF8", border: "#BEA7D4", onAccent: "#FFFFFF" },
  { accent: "#2E839D", strong: "#1D6075", soft: "#E5F3F7", border: "#91C5D3", onAccent: "#FFFFFF" },
  { accent: "#A66D22", strong: "#754A12", soft: "#F8F0E2", border: "#D5B47F", onAccent: "#FFFFFF" },
];

export const OPEN_PLAYER_THEME: OwnerTheme = {
  accent: "#C49618", strong: "#72550A", soft: "#FBF3D6", border: "#E0C66E", onAccent: "#FFFFFF",
};

const cleanOwnerName = (name?: string | null) => String(name ?? "")
  .replace(/^owned by\s+/i, "")
  .replace(/\s*·\s*you$/i, "")
  .trim()
  .toLocaleLowerCase();

export function ownerTheme(name?: string | null): OwnerTheme {
  const normalized = cleanOwnerName(name);
  if (!normalized || normalized === "available" || normalized === "openplayer" || normalized === "open player") return OPEN_PLAYER_THEME;
  if (OWNER_THEMES[normalized]) return OWNER_THEMES[normalized];
  const firstName = normalized.split(/[.\s]/)[0];
  if (OWNER_THEMES[firstName]) return OWNER_THEMES[firstName];
  const hash = [...normalized].reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 0);
  return FALLBACK_THEMES[hash % FALLBACK_THEMES.length];
}
