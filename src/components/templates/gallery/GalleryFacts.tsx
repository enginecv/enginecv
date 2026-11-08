"use client";

import { useTranslation } from "@/lib/i18n";
import type { GalleryTemplate } from "@/lib/templates/gallery";

/** Short facts about a template as chips: columns and photo. */
export function GalleryFactChips({ entry }: { entry: GalleryTemplate }) {
    const { t } = useTranslation();
    const facts = [
        entry.columns === "two" ? t("gallery.factTwoColumns") : t("gallery.factOneColumn"),
        entry.photo ? t("gallery.factPhoto") : t("gallery.factNoPhoto"),
    ];
    return (
        <ul className="flex flex-wrap gap-2">
            {facts.map((fact) => (
                <li key={fact} className="rounded-full border border-edge px-2.5 py-1 text-xs text-mid">
                    {fact}
                </li>
            ))}
        </ul>
    );
}
