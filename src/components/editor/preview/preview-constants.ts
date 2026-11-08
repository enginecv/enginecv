import {
    Globe, Linkedin, Github, Twitter, Facebook, Instagram, Youtube,
    Briefcase, Heart, Star, BookOpen, GraduationCap,
    Award, FolderOpen, Users, Contact, PenLine, Puzzle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CUSTOM_ICON_LUCIDE_MAP } from "../FormUtils";
import { resolveBrandValue, autoMatchBrand, type IconComponent } from "@/lib/icons/brand-icons";

export const PREVIEW_PAGE_GAP_PX = 32;

// Paper dimensions in px at 96 DPI
export const PAPER = {
    a4: { width: 794, height: 1123 },
    letter: { width: 816, height: 1056 },
};

export const PX_PER_MM = 96 / 25.4;
export const PX_PER_PT = 96 / 72;

export function mmToPx(value: number) {
    return value * PX_PER_MM;
}

export function ptToPx(value: number) {
    return value * PX_PER_PT;
}

export function buildPhotoFilterValue(filter: {
    brightness: number;
    contrast: number;
    saturate: number;
    grayscale: number;
    sepia: number;
    hueRotate: number;
    blur: number;
}) {
    return [
        `brightness(${filter.brightness}%)`,
        `contrast(${filter.contrast}%)`,
        `saturate(${filter.saturate}%)`,
        `grayscale(${filter.grayscale}%)`,
        `sepia(${filter.sepia}%)`,
        `hue-rotate(${filter.hueRotate}deg)`,
        `blur(${filter.blur}px)`,
    ].join(" ");
}

// Map social network names to lucide icons
export const SOCIAL_ICON_MAP: Record<string, LucideIcon> = {
    LinkedIn: Linkedin,
    GitHub: Github,
    X: Twitter,
    Twitter: Twitter,
    Facebook: Facebook,
    Instagram: Instagram,
    YouTube: Youtube,
};

export function getSocialIcon(name: string): LucideIcon {
    return SOCIAL_ICON_MAP[name] || Globe;
}

export const SECTION_DEFAULT_ICON_MAP: Record<string, LucideIcon> = {
    experience: Briefcase,
    education: GraduationCap,
    skills: Star,
    languages: Globe,
    certificates: Award,
    interests: Heart,
    projects: FolderOpen,
    courses: BookOpen,
    awards: Award,
    organisations: Users,
    publications: BookOpen,
    references: Contact,
    declaration: PenLine,
    custom: Puzzle,
};

export function getCustomLinkIcon(name: string, icon?: string): IconComponent {
    if (icon && icon !== "auto") {
        const brand = resolveBrandValue(icon);
        if (brand) return brand.Comp;
        return CUSTOM_ICON_LUCIDE_MAP[icon] || Globe;
    }
    if (SOCIAL_ICON_MAP[name]) return SOCIAL_ICON_MAP[name];
    const auto = autoMatchBrand(name);
    if (auto) return auto.Comp;
    return Globe;
}

// Skill chips only show an icon that means something: an explicit pick or a
// recognised brand. Unlike links, a skill like "User Research" gets no globe.
export function getSkillIcon(name: string, icon?: string): IconComponent | null {
    if (icon && icon !== "auto") return getCustomLinkIcon(name, icon);
    return autoMatchBrand(name)?.Comp ?? null;
}

// Official brand colour for a name/icon pairing, or null when there is none
// (generic lucide icon, social, or an unmatched name). Used by skill chips in
// brand-colour mode; monochrome mode ignores it and tints with the accent.
export function getBrandIconHex(name: string, icon?: string): string | null {
    if (icon && icon !== "auto") return resolveBrandValue(icon)?.hex ?? null;
    return autoMatchBrand(name)?.hex ?? null;
}
