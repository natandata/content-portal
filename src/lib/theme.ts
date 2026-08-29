export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "content-portal-theme";

/**
 * Roda antes da primeira pintura, no <head>, para o app nunca aparecer claro e
 * piscar para escuro. E uma string porque vai inline em um <script>.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var pref = stored === "light" || stored === "dark" ? stored : "system";
    var dark =
      pref === "dark" ||
      (pref === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`.trim();

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
