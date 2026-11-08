import { create } from "zustand";
import { useEffect } from "react";
import { useClientPreferencesStore } from "./preferences/store";
import type { ClientPreferences } from "./preferences/schema";

export type ThemePreference = ClientPreferences["appearance"]["theme"];
export type ResolvedTheme = "light" | "dark";

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  if (resolved === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

interface ThemeState {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  _hydrated: boolean;
  setPreference: (preference: ThemePreference) => void;
  _hydrate: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: "dark",
  resolvedTheme: "dark",
  _hydrated: false,
  setPreference: (preference) => {
    const resolved = resolve(preference);
    useClientPreferencesStore.getState().updateSection("appearance", { theme: preference });
    applyTheme(resolved);
    set({ preference, resolvedTheme: resolved });
  },
  _hydrate: () => {
    if (typeof window === "undefined") return;
    const preferencesStore = useClientPreferencesStore.getState();
    if (!preferencesStore.hydrated) preferencesStore.hydrate();
    const preference = useClientPreferencesStore.getState().preferences.appearance.theme;
    const resolved = resolve(preference);
    applyTheme(resolved);
    set({ preference, resolvedTheme: resolved, _hydrated: true });
  },
}));

useClientPreferencesStore.subscribe((state, previous) => {
  const preference = state.preferences.appearance.theme;
  if (preference === previous.preferences.appearance.theme) return;
  const resolvedTheme = resolve(preference);
  applyTheme(resolvedTheme);
  useThemeStore.setState({ preference, resolvedTheme, _hydrated: true });
});

/* Follow OS theme changes live while preference is "system". */
if (typeof window !== "undefined") {
  window
    .matchMedia("(prefers-color-scheme: light)")
    .addEventListener("change", () => {
      const { preference, _hydrated } = useThemeStore.getState();
      if (!_hydrated || preference !== "system") return;
      const resolved = systemTheme();
      applyTheme(resolved);
      useThemeStore.setState({ resolvedTheme: resolved });
    });
}

export function useTheme() {
  const { preference, resolvedTheme, setPreference, _hydrated, _hydrate } = useThemeStore();

  useEffect(() => {
    if (!_hydrated) _hydrate();
  }, [_hydrated, _hydrate]);

  return { preference, resolvedTheme, setPreference };
}
