"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n";

const OPTIONS: { value: ThemePreference; icon: typeof Sun; labelKey: string }[] = [
  { value: "light", icon: Sun, labelKey: "theme.light" },
  { value: "dark", icon: Moon, labelKey: "theme.dark" },
  { value: "system", icon: Monitor, labelKey: "theme.system" },
];

export function ThemeToggle({
  buttonClassName,
}: {
  buttonClassName?: string;
}) {
  const { preference, resolvedTheme, setPreference } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  const CurrentIcon = resolvedTheme === "light" ? Sun : Moon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`touch-manipulation flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-faint transition-colors hover:bg-edge hover:text-strong ${buttonClassName || ""}`}
        aria-label={t("theme.label")}
        aria-expanded={open}
        title={t("theme.label")}
      >
        <CurrentIcon className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-xl border border-edge bg-surface-4 p-1 shadow-xl">
          {OPTIONS.map(({ value, icon: Icon, labelKey }) => (
            <button
              key={value}
              onClick={() => {
                setPreference(value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm leading-snug transition-colors ${
                value === preference
                  ? "bg-accent/15 text-accent"
                  : "text-faint hover:bg-edge hover:text-strong"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
