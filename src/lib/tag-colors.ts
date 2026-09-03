/**
 * Cor de uma etiqueta de texto livre (tarefas, e qualquer outro lugar que
 * precise de tag colorida sem cadastro previo de cor). A mesma string sempre
 * cai na mesma cor — nao precisa guardar cor no banco.
 */
const PALETTE = [
  "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-400/12 dark:text-violet-300 dark:ring-violet-400/25",
  "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-400/12 dark:text-rose-300 dark:ring-rose-400/25",
  "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/12 dark:text-amber-300 dark:ring-amber-400/25",
  "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/12 dark:text-emerald-300 dark:ring-emerald-400/25",
  "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-400/12 dark:text-sky-300 dark:ring-sky-400/25",
  "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-400/12 dark:text-orange-300 dark:ring-orange-400/25",
  "bg-pink-50 text-pink-700 ring-pink-200 dark:bg-pink-400/12 dark:text-pink-300 dark:ring-pink-400/25",
  "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-400/12 dark:text-teal-300 dark:ring-teal-400/25",
] as const;

export function tagColorClass(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0];
}
