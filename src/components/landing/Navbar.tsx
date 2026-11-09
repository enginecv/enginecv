"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { IntentPrefetchLink } from "@/components/ui/IntentPrefetchLink";
import { AppEntryLink } from "@/components/ui/AppEntryLink";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import styles from "./Navbar.module.css";
import { localizedPath } from "@/lib/i18n/locales";
import { GALLERY_PATH } from "@/lib/templates/gallery";
import { blogIndexPath } from "@/lib/blog-articles";

export function Navbar() {
  const { t, locale } = useTranslation();
  const pathname = usePathname();
  const homeHref = localizedPath("/", locale);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const resolveHref = (href: string) => {
    if (href.startsWith("#") && pathname !== homeHref) {
      return `${homeHref}${href}`;
    }

    return href;
  };

  const NAV_LINKS = [
    { label: t("nav.templates"), href: localizedPath(GALLERY_PATH, locale) },
    { label: t("nav.features"), href: "#features" },
    { label: t("nav.faq"), href: "#faq" },
    { label: t("nav.blog"), href: blogIndexPath(locale) },
    { label: t("footer.about"), href: "/about" },
    { label: t("nav.contact"), href: "/contact" },
  ];
  const navLinkClass =
    "touch-manipulation rounded-full px-3 py-2 text-sm text-faint transition-colors hover:text-strong";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled
          ? "bg-surface-2/80 backdrop-blur-xl border-edge shadow-lg shadow-black/10"
          : "bg-transparent border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 min-h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href={homeHref} className="flex items-center gap-2 group" aria-label="EngineCV">
          <Image
            src="/logo.svg"
            alt="EngineCV"
            width={800}
            height={600}
            priority
            style={{ width: "auto" }}
            className="h-10 logo-adaptive"
          />
          <span className="text-lg font-semibold tracking-tight text-strong transition-colors">
            EngineCV
          </span>
        </Link>

        {/* Center Nav */}
        <div className={`${styles.desktopNav} min-w-0 flex-1 items-center justify-center`}>
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap">
            {NAV_LINKS.map((link) => {
              const resolvedHref = resolveHref(link.href);

              return resolvedHref.startsWith("/") ? (
                <IntentPrefetchLink
                  key={link.href}
                  href={resolvedHref}
                  className={navLinkClass}
                >
                  {link.label}
                </IntentPrefetchLink>
              ) : (
                <a
                  key={link.href}
                  href={resolvedHref}
                  className={navLinkClass}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>

        {/* Right */}
        <div className={`${styles.desktopActions} shrink-0 items-center gap-3`}>
          <ThemeToggle />
          <LanguageSwitcher fullLabel buttonClassName="border border-edge" />
          
          <AppEntryLink
            href="/dashboard"
            className="px-4 py-2 bg-accent hover:bg-accent-soft text-surface-2 text-sm font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-accent/25"
          >
            {t("nav.startBuilding")}
          </AppEntryLink>
        </div>

        {/* Mobile actions */}
        <div className={`${styles.mobileToggle} items-center gap-1`}>
          <ThemeToggle />
          <LanguageSwitcher compact />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="touch-manipulation text-strong p-2"
            aria-label={t("nav.toggleMenu")}
          >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
              {mobileOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <>
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className={`${styles.mobileMenu} bg-surface-2/95 backdrop-blur-xl border-b border-edge px-6 py-4 space-y-4`}>
          {NAV_LINKS.map((link) => {
            const resolvedHref = resolveHref(link.href);

            return resolvedHref.startsWith("/") ? (
              <IntentPrefetchLink
                key={link.href}
                href={resolvedHref}
                onClick={() => setMobileOpen(false)}
                className="touch-manipulation block rounded-lg px-3 py-2 text-sm text-faint transition-colors hover:text-strong"
              >
                {link.label}
              </IntentPrefetchLink>
            ) : (
              <a
                key={link.href}
                href={resolvedHref}
                onClick={() => setMobileOpen(false)}
                className="touch-manipulation block rounded-lg px-3 py-2 text-sm text-faint transition-colors hover:text-strong"
              >
                {link.label}
              </a>
            );
          })}
          <div className="pt-4 border-t border-edge space-y-3">
            <AppEntryLink
              href="/dashboard"
              className="block w-full text-center px-4 py-2.5 bg-accent text-surface-2 text-sm font-medium rounded-lg"
            >
              {t("nav.startBuilding")}
            </AppEntryLink>
          </div>
        </div>
      )}
    </nav>
  );
}
