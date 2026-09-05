/**
 * Paleta de capas do cliente — so cor, sem upload de imagem. Cada uma e um
 * degrade Tailwind pronto; o banco guarda so a chave (`clients.cover_color`).
 */
export const COVER_PALETTE = {
  sunset: { label: "Por do sol", gradient: "from-orange-400 to-pink-400" },
  orchid: { label: "Orquidea", gradient: "from-fuchsia-300 to-purple-400" },
  citrus: { label: "Citrico", gradient: "from-yellow-300 to-lime-400" },
  sky: { label: "Ceu", gradient: "from-sky-300 to-indigo-400" },
  coral: { label: "Coral", gradient: "from-rose-400 to-orange-300" },
  mint: { label: "Menta", gradient: "from-emerald-300 to-teal-400" },
  grape: { label: "Uva", gradient: "from-purple-400 to-indigo-500" },
  slate: { label: "Ardosia", gradient: "from-slate-400 to-slate-600" },
} as const;

export type CoverColorKey = keyof typeof COVER_PALETTE;
export const DEFAULT_COVER_COLOR: CoverColorKey = "sunset";
export const COVER_COLOR_KEYS = Object.keys(COVER_PALETTE) as CoverColorKey[];

function isCoverColorKey(value: string | null | undefined): value is CoverColorKey {
  return Boolean(value) && Object.hasOwn(COVER_PALETTE, value as string);
}

/** Classe do degrade para uma chave salva — chave desconhecida ou nula cai no padrao. */
export function coverGradientClass(key: string | null | undefined): string {
  return COVER_PALETTE[isCoverColorKey(key) ? key : DEFAULT_COVER_COLOR].gradient;
}
