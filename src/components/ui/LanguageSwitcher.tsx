"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { localeLabels, type Locale } from "@/lib/i18n";
import { isPrefixedLocale, localizedPath } from "@/lib/i18n/locales";
import { useLanguageLinks, useRouteLocale } from "@/lib/i18n/route-locale";
import { Languages } from "lucide-react";
import { useState, useRef, useEffect, type CSSProperties } from "react";

const locales = Object.keys(localeLabels) as Locale[];
const MENU_MAX_WIDTH = 192;
const MENU_MARGIN = 8;
const MENU_OFFSET = 4;

export function LanguageSwitcher({
  compact,
  fullLabel,
  buttonClassName,
}: {
  compact?: boolean;
  fullLabel?: boolean;
  buttonClassName?: string;
}) {
  const { t, locale, setLocale } = useTranslation();
  // On a locale URL ("/", "/de") each language is its own page, so the menu
  // links to it; elsewhere it switches the stored app language in place.
  const routeLocale = useRouteLocale();
  // Pages whose address changes by more than the prefix (blog posts) say where each language lives.
  const languageLinks = useLanguageLinks();
  const pathname = usePathname() ?? "/";
  const [, firstSegment, ...rest] = pathname.split("/");
  const basePath = isPrefixedLocale(firstSegment ?? "") ? `/${rest.join("/")}` : pathname;
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const label = fullLabel ? localeLabels[locale] : locale;

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  const updateMenuPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(MENU_MAX_WIDTH, Math.max(0, viewportWidth - MENU_MARGIN * 2));
    const estimatedHeight = locales.length * 40 + 16;
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - MENU_MARGIN);
    const spaceAbove = Math.max(0, rect.top - MENU_MARGIN);
    const dropUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.max(0, Math.min(estimatedHeight, dropUp ? spaceAbove : spaceBelow));
    const left = Math.min(
      Math.max(rect.right - width, MENU_MARGIN),
      Math.max(MENU_MARGIN, viewportWidth - width - MENU_MARGIN)
    );

    setMenuStyle({
      left,
      width,
      maxHeight: maxHeight || undefined,
      ...(dropUp
        ? { bottom: Math.max(MENU_MARGIN, viewportHeight - rect.top + MENU_OFFSET) }
        : { top: Math.min(viewportHeight - MENU_MARGIN, rect.bottom + MENU_OFFSET) }),
    });
  };

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    const reposition = () => updateMenuPosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const handleToggle = () => {
    setOpen((wasOpen) => {
      const willOpen = !wasOpen;
      if (willOpen) {
        updateMenuPosition();
      }
      return willOpen;
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        ref={buttonRef}
        onClick={handleToggle}
        className={`touch-manipulation flex items-center gap-1.5 rounded-lg ${compact ? "px-2" : "px-2.5"} py-1.5 text-sm text-faint transition-colors hover:bg-edge hover:text-strong ${buttonClassName || ""}`}
        aria-label={t("language.change")}
      >
        <Languages className="h-4 w-4" />
        <span className={`text-xs font-medium ${fullLabel ? "" : "uppercase"}`}>
          {label}
        </span>
      </button>

      {open && (
        <div
          className="fixed z-50 overflow-y-auto rounded-xl border border-edge bg-surface-4 p-1 shadow-xl"
          style={menuStyle ?? undefined}
        >
          {locales.map((l) => {
            const className = `block w-full rounded-lg px-3 py-2 text-left text-sm leading-snug transition-colors ${
              l === locale
                ? "bg-accent/15 text-accent"
                : "text-faint hover:text-strong hover:bg-edge"
            }`;
            const choose = () => {
              setLocale(l);
              setOpen(false);
            };
            return routeLocale ? (
              <Link
                key={l}
                href={languageLinks?.[l] ?? localizedPath(basePath, l)}
                hrefLang={l}
                lang={l}
                onClick={choose}
                className={className}
              >
                {localeLabels[l]}
              </Link>
            ) : (
              <button key={l} onClick={choose} className={className}>
                {localeLabels[l]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
