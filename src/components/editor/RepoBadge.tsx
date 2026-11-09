"use client";

import { Github, GitBranch } from "lucide-react";
import type { ComponentType, CSSProperties, SVGProps } from "react";
import {
    detectPlatform,
    getPlatform,
    parseRepoUrl,
    repoDisplayName,
    type RepoPlatform,
    type RepoPlatformKey,
} from "@/lib/repo-links";
import type { ProjectRepo } from "@/lib/schema";
import { buildBoxBorderStyles, hexToRgba } from "@/lib/preview/box-style";
import { fontFamilyInlineValue } from "@/lib/fonts";
import { contrastRatio, ensureReadableAccent, normalizeHex } from "@/lib/color-contrast";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export interface RepoBadgeSettings {
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fontStyle: "normal" | "italic";
    textTransform: "none" | "uppercase" | "capitalize" | "lowercase";
    letterSpacing: number;
    paddingX: number;
    paddingY: number;
    gap: number;
    marginTop: number;
    marginBottom: number;
    iconSize: number;
    colorMode: "platform" | "custom" | "accent" | "monochrome";
    textColor: string;
    backgroundColor: string;
    backgroundOpacity: number;
    borderColor: string;
    borderOpacity: number;
    border: {
        style: "solid" | "dotted" | "dashed";
        width: number;
        color: string;
        radius: number;
        top: boolean;
        bottom: boolean;
        left: boolean;
        right: boolean;
        dashLength: number;
        dashGap: number;
    };
    showIcon: boolean;
    showPlatformName: boolean;
    showVisibility: boolean;
}

const DEFAULT_REPO_BADGE_SETTINGS: RepoBadgeSettings = {
    fontFamily: "",
    fontSize: 9,
    fontWeight: "600",
    fontStyle: "normal",
    textTransform: "none",
    letterSpacing: 0,
    paddingX: 8,
    paddingY: 2,
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
    iconSize: 0.85,
    colorMode: "platform",
    textColor: "",
    backgroundColor: "",
    backgroundOpacity: 0.1,
    borderColor: "",
    borderOpacity: 0.33,
    border: {
        style: "solid",
        width: 1,
        color: "",
        radius: 999,
        top: true,
        bottom: true,
        left: true,
        right: true,
        dashLength: 6,
        dashGap: 4,
    },
    showIcon: true,
    showPlatformName: false,
    showVisibility: false,
};

function GitLabIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
            <path d="M22.65 14.39 12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 5.5 2a.43.43 0 0 1 .41.3l2.44 7.49h7.5l2.44-7.51A.42.42 0 0 1 18.7 2a.43.43 0 0 1 .41.3l2.44 7.51L22.95 13.45a.84.84 0 0 1-.3.94z" />
        </svg>
    );
}

function BitbucketIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
            <path d="M.778 1.213a.769.769 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
        </svg>
    );
}

function AzureDevOpsIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
            <path d="M0 8.877L2.247 5.91l8.405-3.416V.022l7.37 5.393L2.966 8.338v9.038L0 16.524zm24-4.565v14.93l-5.738 4.735-9.282-3.04v3.063L2.966 16.5l15.978 1.245V5.13z" />
        </svg>
    );
}

const PLATFORM_ICONS: Record<RepoPlatformKey, IconComponent> = {
    github: Github,
    gitlab: GitLabIcon,
    bitbucket: BitbucketIcon,
    "azure-devops": AzureDevOpsIcon,
    codeberg: GitBranch,
    sourcehut: GitBranch,
    other: GitBranch,
};

export function RepoIcon({ platform, className, style }: { platform: RepoPlatformKey; className?: string; style?: CSSProperties }) {
    const Icon = PLATFORM_ICONS[platform] ?? GitBranch;
    return <Icon className={className} style={style} />;
}

/** A platform colour that reads on the resume page: kept if it has enough contrast, else adjusted. */
function readableOnPage(color: string, pageBackground: string, fallbackText: string): string {
    const fg = normalizeHex(color);
    const bg = normalizeHex(pageBackground);
    if (!fg || !bg) return fallbackText;
    if (contrastRatio(fg, bg) >= 3) return fg;
    // A light page can take a darker shade of the same hue; on a dark or tinted
    // page fall back to the resume's own text colour.
    return contrastRatio("#ffffff", bg) < 2 ? ensureReadableAccent(fg) : fallbackText;
}

function resolveColors(
    platform: RepoPlatform,
    settings: RepoBadgeSettings,
    accent: string,
    fallbackText: string,
    pageBackground: string,
): { text: string; background: string; border: string } {
    if (settings.colorMode === "custom") {
        const text = settings.textColor || fallbackText;
        const bgBase = settings.backgroundColor || accent;
        const borderBase = settings.borderColor || text;
        return {
            text,
            background: hexToRgba(bgBase, settings.backgroundOpacity),
            border: hexToRgba(borderBase, settings.borderOpacity),
        };
    }
    if (settings.colorMode === "accent") {
        return {
            text: accent,
            background: hexToRgba(accent, settings.backgroundOpacity),
            border: hexToRgba(accent, settings.borderOpacity),
        };
    }
    if (settings.colorMode === "monochrome") {
        return {
            text: fallbackText,
            background: hexToRgba(fallbackText, settings.backgroundOpacity),
            border: hexToRgba(fallbackText, settings.borderOpacity),
        };
    }
    const platformColor = readableOnPage(platform.accent, pageBackground, fallbackText);
    return {
        text: platformColor,
        background: hexToRgba(platformColor, settings.backgroundOpacity),
        border: hexToRgba(platformColor, settings.borderOpacity),
    };
}

export interface RepoBadgeProps {
    repo: ProjectRepo;
    settings?: RepoBadgeSettings;
    accentColor?: string;
    textColor?: string;
    /** Colour of the resume page the badge sits on, used to keep platform colours readable. */
    pageBackground?: string;
    variant?: "preview" | "editor";
}

export function RepoBadge({ repo, settings, accentColor = "#ffaa8d", textColor = "#111827", pageBackground = "#ffffff", variant = "preview" }: RepoBadgeProps) {
    const effectiveSettings = settings ?? DEFAULT_REPO_BADGE_SETTINGS;
    const platform =
        repo.platform && repo.platform !== "auto"
            ? getPlatform(repo.platform)
            : detectPlatform(repo.url);
    const parsed = parseRepoUrl(repo.url);
    const display = repo.label?.trim() || repoDisplayName(parsed, repo.url);

    if (variant === "editor") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-surface-1 px-2 py-1 text-[11px] text-bright">
                <RepoIcon platform={platform.key} className="h-3 w-3" />
                <span>{platform.label}</span>
            </span>
        );
    }

    const colors = resolveColors(platform, effectiveSettings, accentColor, textColor, pageBackground);
    const borderForBadge = {
        ...effectiveSettings.border,
        color: colors.border,
    };
    const borderStyles = buildBoxBorderStyles(borderForBadge, colors.border);

    const href = parsed?.href || repo.url;
    const style: CSSProperties = {
        ...borderStyles,
        color: colors.text,
        backgroundColor: colors.background,
        padding: `${effectiveSettings.paddingY}px ${effectiveSettings.paddingX}px`,
        fontSize: `${effectiveSettings.fontSize}pt`,
        fontWeight: effectiveSettings.fontWeight,
        fontStyle: effectiveSettings.fontStyle,
        fontFamily: fontFamilyInlineValue(effectiveSettings.fontFamily, "mono"),
        textTransform: effectiveSettings.textTransform === "none" ? undefined : effectiveSettings.textTransform,
        letterSpacing: `${effectiveSettings.letterSpacing}em`,
        textDecoration: "none",
        lineHeight: 1.2,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4em",
        whiteSpace: "nowrap",
    };

    const iconStyle: CSSProperties = {
        width: `${effectiveSettings.iconSize}em`,
        height: `${effectiveSettings.iconSize}em`,
        flexShrink: 0,
    };

    return (
        <a
            href={href || undefined}
            target="_blank"
            rel="noopener noreferrer"
            data-platform={platform.key}
            style={style}
            title={`${platform.label}: ${display}`}
        >
            {effectiveSettings.showIcon && <RepoIcon platform={platform.key} style={iconStyle} />}
            {effectiveSettings.showPlatformName && <span style={{ opacity: 0.7 }}>{platform.label}</span>}
            <span>{display}</span>
        </a>
    );
}

export interface RepoBadgeListProps {
    repos: ProjectRepo[] | undefined;
    settings?: RepoBadgeSettings;
    accentColor?: string;
    textColor?: string;
    pageBackground?: string;
}

export function RepoBadgeList({ repos, settings, accentColor, textColor, pageBackground }: RepoBadgeListProps) {
    if (!repos || repos.length === 0) return null;
    const valid = repos.filter((r) => r && (r.url || "").trim().length > 0);
    if (valid.length === 0) return null;
    const effectiveSettings = settings ?? DEFAULT_REPO_BADGE_SETTINGS;
    return (
        <div
            className="flex flex-wrap items-center"
            style={{
                gap: `${effectiveSettings.gap}px`,
                marginTop: `${effectiveSettings.marginTop}px`,
                marginBottom: `${effectiveSettings.marginBottom}px`,
            }}
        >
            {valid.map((repo) => (
                <RepoBadge
                    key={repo.id}
                    repo={repo}
                    settings={effectiveSettings}
                    accentColor={accentColor}
                    textColor={textColor}
                    pageBackground={pageBackground}
                />
            ))}
        </div>
    );
}

export { DEFAULT_REPO_BADGE_SETTINGS };
