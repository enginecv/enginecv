"use client";

import { useTranslation } from "@/lib/i18n";
import { githubPersonalDetails } from "@/lib/import/map-to-resume";
import type { NormalizedProfile } from "@/lib/import/provider";

/** The rows to show: label key and value, only those GitHub has. */
export function personalDetailRows(profile: NormalizedProfile): Array<{ key: string; labelKey: string; value: string }> {
    const details = githubPersonalDetails(profile);
    return [
        { key: "name", labelKey: "importHub.field.name", value: details.name },
        { key: "email", labelKey: "importHub.field.email", value: details.email },
        { key: "location", labelKey: "importHub.field.location", value: details.location },
        { key: "website", labelKey: "importHub.field.website", value: details.website },
        { key: "github", labelKey: "importHub.field.github", value: details.github },
        { key: "x", labelKey: "githubImport.detail.x", value: details.x && `@${details.x}` },
        { key: "summary", labelKey: "importHub.field.summary", value: details.summary },
    ].filter((row) => row.value.trim() !== "");
}

/** What the import writes into the person's own details. Read-only: picking between versions happens on review. */
export function PersonalDetailsPreview({ profile }: { profile: NormalizedProfile }) {
    const { t } = useTranslation();
    const rows = personalDetailRows(profile);

    if (rows.length === 0 && !profile.avatarUrl) {
        return <p className="text-xs text-dim">{t("githubImport.detailsEmpty")}</p>;
    }

    return (
        <dl className="divide-y divide-edge rounded-lg border border-edge bg-surface-1" data-testid="github-import-details">
            {profile.avatarUrl && (
                <div className="flex items-center gap-3 px-3 py-2">
                    <dt className="w-24 shrink-0 text-xs text-dim">{t("importHub.field.photo")}</dt>
                    <dd>
                        {/* eslint-disable-next-line @next/next/no-img-element -- external GitHub CDN avatar, ephemeral preview */}
                        <img src={profile.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    </dd>
                </div>
            )}
            {rows.map((row) => (
                <div key={row.key} className="flex items-start gap-3 px-3 py-2" data-testid={`github-import-detail-${row.key}`}>
                    <dt className="w-24 shrink-0 pt-px text-xs text-dim">{t(row.labelKey)}</dt>
                    <dd className="min-w-0 flex-1 break-words text-sm text-strong">{row.value}</dd>
                </div>
            ))}
        </dl>
    );
}
