interface UABrand {
    brand: string;
    version: string;
}

interface UADataValues {
    brands?: UABrand[];
    fullVersionList?: UABrand[];
    mobile?: boolean;
    platform?: string;
    platformVersion?: string;
    architecture?: string;
    bitness?: string;
    model?: string;
}

interface NavigatorUAData {
    brands: UABrand[];
    mobile: boolean;
    platform: string;
    getHighEntropyValues(hints: string[]): Promise<UADataValues>;
}

const UNINTERESTING_BRAND = /not[._\s]a[._\s]?brand|chromium/i;

function formatPlatform(platform: string, version: string): string {
    if (platform === "Windows" && version) {
        const major = Number.parseInt(version.split(".")[0] ?? "", 10);
        if (Number.isFinite(major)) {
            if (major >= 13) return `Windows 11 (${version})`;
            if (major > 0) return `Windows 10 (${version})`;
        }
        return "Windows";
    }
    return version ? `${platform} ${version}` : platform || "Unknown OS";
}

function pickBrand(brands: UABrand[]): UABrand | undefined {
    const named = brands.find((b) => !UNINTERESTING_BRAND.test(b.brand));
    return named ?? brands[0];
}

export async function detectUserAgent(): Promise<string> {
    if (typeof navigator === "undefined") return "";

    const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;

    if (uaData?.getHighEntropyValues) {
        try {
            const hints = await uaData.getHighEntropyValues([
                "platformVersion",
                "fullVersionList",
            ]);
            const brands = hints.fullVersionList ?? uaData.brands ?? [];
            const branded = pickBrand(brands);
            const brand = branded?.brand ?? "Unknown browser";
            const brandVer = branded?.version ?? "";
            const platform = hints.platform ?? uaData.platform ?? "";
            const platformVer = hints.platformVersion ?? "";
            const prettyOS = formatPlatform(platform, platformVer);
            const mobile = uaData.mobile ? " (mobile)" : "";

            return `${brand} ${brandVer} on ${prettyOS}${mobile}`.trim();
        } catch {
            // fall through to legacy UA
        }
    }

    return navigator.userAgent;
}
