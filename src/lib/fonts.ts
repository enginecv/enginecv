// Font role system.
//
// Three global font "roles" act like CSS custom properties (--font-primary,
// --font-secondary, --font-mono) defined once on the resume root:
//   - primary   → titles / section headings
//   - secondary → body text (authoritative source is typography.fontFamily,
//                  so existing resumes render unchanged)
//   - mono      → tags, skills, repo badges, code-like accents
//
// Per-element font fields (header, headings, repo badge, design overlays…) keep
// working as literal font families, but may now instead reference a role via the
// sentinel value "var:<role>" — the CSS-variable "inherit a default, override
// when you want" model. Empty string means "inherit this element's default role".

export const FONT_ROLES = ["primary", "secondary", "mono"] as const;
export type FontRole = (typeof FONT_ROLES)[number];

export const PRESET_FONTS = [
    "Inter",
    "Roboto",
    "Playfair Display",
    "Merriweather",
    "Inconsolata",
    "JetBrains Mono",
    "Lora",
    "Source Serif Pro",
    "Courier Prime",
    "Source Sans 3",
    "IBM Plex Sans",
    "IBM Plex Mono",
    "EB Garamond",
    "Atkinson Hyperlegible Next",
] as const;

export interface RoleFonts {
    primary: string;
    secondary: string;
    mono: string;
}

const ROLE_REF_PREFIX = "var:";

/** Build a role reference value for storage, e.g. roleRef("primary") → "var:primary". */
export function roleRef(role: FontRole): string {
    return `${ROLE_REF_PREFIX}${role}`;
}

/** The role a "var:<role>" value points at, or null for literal/empty values. */
export function parseRoleRef(value: string | undefined | null): FontRole | null {
    if (!value || !value.startsWith(ROLE_REF_PREFIX)) return null;
    const role = value.slice(ROLE_REF_PREFIX.length);
    return (FONT_ROLES as readonly string[]).includes(role) ? (role as FontRole) : null;
}

interface TypographyLike {
    fontFamily?: string;
    fonts?: { primary?: string; mono?: string; secondary?: string };
}

/**
 * Resolve the three role slots to concrete family names. Secondary is the body
 * font (typography.fontFamily); primary and mono fall back to the body font when
 * unset, so a fresh document looks identical until a role is customized.
 */
export function getRoleFonts(typography: TypographyLike | undefined): RoleFonts {
    const body = (typography?.fontFamily || "").trim() || "Inter";
    const fonts = typography?.fonts || {};
    const secondary = (fonts.secondary || "").trim() || body;
    return {
        primary: (fonts.primary || "").trim() || secondary,
        secondary,
        mono: (fonts.mono || "").trim() || secondary,
    };
}

function genericFor(role: FontRole): string {
    return role === "mono" ? "monospace" : "sans-serif";
}

/** The `--font-<role>` custom-property value, e.g. `"Inter", sans-serif`. */
export function roleFontStack(role: FontRole, roleFonts: RoleFonts): string {
    return `"${roleFonts[role]}", ${genericFor(role)}`;
}

/**
 * font-family value for a `<style>` rule. Role refs (and empty → default role)
 * emit `var(--font-<role>)`; literals emit `"Family", <generic>`.
 */
export function fontFamilyCssValue(value: string | undefined, defaultRole: FontRole): string {
    const v = (value || "").trim();
    if (!v) return `var(--font-${defaultRole})`;
    const role = parseRoleRef(v);
    if (role) return `var(--font-${role})`;
    return `"${v}", ${genericFor(defaultRole)}`;
}

/**
 * font-family value for an inline `style` object. Role refs (and empty → default
 * role) emit `var(--font-<role>)` — an undefined var safely falls back to the
 * inherited font, so this is safe even outside the resume root. Literals emit the
 * bare family name.
 */
export function fontFamilyInlineValue(value: string | undefined, defaultRole: FontRole): string {
    const v = (value || "").trim();
    if (!v) return `var(--font-${defaultRole})`;
    const role = parseRoleRef(v);
    if (role) return `var(--font-${role})`;
    return v;
}
