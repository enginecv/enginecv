import type { ReactNode } from "react";
import { Footer } from "@/components/landing/Footer";
import { Navbar } from "@/components/landing/Navbar";
import { RouteLocaleProvider } from "@/lib/i18n/route-locale";
import type { Locale } from "@/lib/i18n/locales";

/** Page chrome for the public gallery, rendered in the URL's locale. */
export function GalleryPage({ locale, children }: { locale: Locale; children: ReactNode }) {
    return (
        <RouteLocaleProvider locale={locale}>
            <div className="flex min-h-screen flex-col overflow-x-clip bg-surface-2 text-strong font-[family-name:var(--font-geist-sans)]">
                <Navbar />
                <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-28 sm:px-6">
                    {children}
                </main>
                <Footer />
            </div>
        </RouteLocaleProvider>
    );
}
