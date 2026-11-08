"use client";

import { Github } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type { PreviewState } from "@/lib/import/profile-preview";

export interface ProfilePreviewCardProps {
    state: PreviewState;
    /** Suppress the plain not-found notice (a suggestion list is covering it). */
    hideNotFound?: boolean;
}

/**
 * Informational confirm-on-type preview under the import dialog's input.
 * Renders nothing for idle and silent-error states — the preview is a
 * progressive enhancement and must never look like a blocker.
 */
export function ProfilePreviewCard({ state, hideNotFound = false }: ProfilePreviewCardProps) {
    const { t } = useTranslation();
    const [failedAvatarUrl, setFailedAvatarUrl] = useState("");

    if (state.status === "idle" || state.status === "silent-error") return null;

    if (state.status === "loading") {
        return (
            <p
                data-testid="github-profile-preview-loading"
                className="text-xs text-dim"
                role="status"
            >
                {t("githubImport.previewLoading")}
            </p>
        );
    }

    if (state.status === "not-found") {
        if (hideNotFound) return null;
        return (
            <p
                data-testid="github-profile-preview-not-found"
                className="text-xs text-dim"
                role="status"
            >
                {t("githubImport.previewNotFound")}
            </p>
        );
    }

    const profile = state.profile;
    if (!profile) return null;
    const showAvatar = profile.avatarUrl && profile.avatarUrl !== failedAvatarUrl;

    return (
        <div
            data-testid="github-profile-preview-card"
            role="status"
            aria-label={t("githubImport.previewCardLabel")}
            className="flex items-center gap-3 rounded-xl border border-edge bg-surface-1 px-3 py-2.5"
        >
            {showAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- external GitHub CDN avatar, ephemeral preview
                <img
                    src={profile.avatarUrl}
                    alt=""
                    onError={() => setFailedAvatarUrl(profile.avatarUrl)}
                    className="h-9 w-9 shrink-0 rounded-full ring-1 ring-accent/60"
                />
            ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-edge">
                    <Github className="h-4 w-4 text-dim" />
                </div>
            )}
            <div className="min-w-0">
                <p className="truncate text-sm font-medium text-strong">
                    {profile.displayName || profile.username}
                </p>
                <p className="truncate text-xs text-dim">@{profile.username}</p>
            </div>
        </div>
    );
}
