function trimEnv(value: string | undefined) {
    return value?.trim() ?? "";
}

export const adsConfig = {
    enabled: process.env.NEXT_PUBLIC_ENABLE_ADS === "true",
    client: trimEnv(process.env.NEXT_PUBLIC_ADSENSE_CLIENT),
    enableAutoAdsPublic: process.env.NEXT_PUBLIC_ENABLE_AUTO_ADS_PUBLIC === "true",
    cmpScriptSrc: trimEnv(process.env.NEXT_PUBLIC_CMP_SCRIPT_SRC),
};

export type AdSurface = "landing" | "dashboard" | "blog" | "examples";

export type AdSlotName =
    | "landing_before_footer"
    | "dashboard_top"
    | "dashboard_after_grid"
    | "blog_index_top"
    | "blog_post_after_intro"
    | "blog_post_mid_1"
    | "blog_post_end"
    | "blog_sidebar_square"
    | "example_after_tips";

type AdSlotFormat = "leaderboard" | "rectangle" | "responsive";

type AdSlotDefinition = {
    format: AdSlotFormat;
    height?: number;
    slotId: string;
    surface: AdSurface;
    width?: number;
};

export type ResolvedAdSlot = AdSlotDefinition & {
    client: string;
};

const adSlotRegistry: Record<AdSlotName, AdSlotDefinition> = {
    landing_before_footer: {
        format: "responsive",
        slotId: trimEnv(process.env.NEXT_PUBLIC_AD_SLOT_LANDING_BEFORE_FOOTER),
        surface: "landing",
    },
    dashboard_top: {
        format: "leaderboard",
        height: 90,
        slotId: trimEnv(process.env.NEXT_PUBLIC_AD_SLOT_DASHBOARD_TOP),
        surface: "dashboard",
        width: 728,
    },
    dashboard_after_grid: {
        format: "leaderboard",
        height: 90,
        slotId: trimEnv(process.env.NEXT_PUBLIC_AD_SLOT_DASHBOARD_AFTER_GRID),
        surface: "dashboard",
        width: 728,
    },
    blog_index_top: {
        format: "responsive",
        slotId: trimEnv(process.env.NEXT_PUBLIC_AD_SLOT_BLOG_INDEX_TOP),
        surface: "blog",
    },
    blog_post_after_intro: {
        format: "responsive",
        slotId: trimEnv(process.env.NEXT_PUBLIC_AD_SLOT_BLOG_POST_AFTER_INTRO),
        surface: "blog",
    },
    blog_post_mid_1: {
        format: "responsive",
        slotId: trimEnv(process.env.NEXT_PUBLIC_AD_SLOT_BLOG_POST_MID_1),
        surface: "blog",
    },
    blog_post_end: {
        format: "responsive",
        slotId: trimEnv(process.env.NEXT_PUBLIC_AD_SLOT_BLOG_POST_END),
        surface: "blog",
    },
    blog_sidebar_square: {
        format: "rectangle",
        height: 250,
        slotId: trimEnv(process.env.NEXT_PUBLIC_AD_SLOT_BLOG_SIDEBAR_SQUARE),
        surface: "blog",
        width: 300,
    },
    example_after_tips: {
        format: "responsive",
        slotId: trimEnv(process.env.NEXT_PUBLIC_AD_SLOT_EXAMPLE_AFTER_TIPS),
        surface: "examples",
    },
};

export function isAdsConfigured() {
    return adsConfig.enabled && /^ca-pub-\d{16}$/.test(adsConfig.client) && getCmpScriptSrc() !== null;
}

export function getCmpScriptSrc(): string | null {
    try {
        const source = new URL(adsConfig.cmpScriptSrc);
        return source.protocol === "https:" ? source.href : null;
    } catch {
        return null;
    }
}

export function getAdSlotDefinition(slotName: AdSlotName): ResolvedAdSlot | null {
    const slot = adSlotRegistry[slotName];
    if (!isAdsConfigured() || !slot.slotId) {
        return null;
    }

    return {
        ...slot,
        client: adsConfig.client,
    };
}

/** Public content and dashboard only. Bosnian is not an AdSense-supported content language. */
export function isAdPageAllowed(pathname: string, locale: string): boolean {
    const segments = pathname.split("/").filter(Boolean);
    const prefixed = ["de", "bs", "fr", "es"].includes(segments[0]);
    const pageLocale = prefixed ? segments.shift() : locale;
    if (!["en", "de", "fr", "es"].includes(pageLocale ?? "")) return false;
    if (segments[0] === "dashboard") return !prefixed && segments.length === 1;
    return ["blog", "resources", "jobs", "cv-examples"].includes(segments[0] ?? "");
}
