import { strToU8, zipSync } from "fflate";

/** File names inside the package; the card snippet references the same names. */
export const README_FILES = {
    markdown: "README.md",
    cardLight: "enginecv-card-light.svg",
    cardDark: "enginecv-card-dark.svg",
} as const;

export interface ReadmePackageContent {
    markdown: string;
    cardLight: string;
    cardDark: string;
}

export function buildReadmePackage(content: ReadmePackageContent): Uint8Array {
    return zipSync({
        [README_FILES.markdown]: strToU8(content.markdown),
        [README_FILES.cardLight]: strToU8(content.cardLight),
        [README_FILES.cardDark]: strToU8(content.cardDark),
    });
}
