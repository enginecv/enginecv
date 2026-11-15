import { describe, expect, it } from "vitest";
import {
    autoMatchBrand,
    BRAND_ICON_CHOICES,
    BRAND_ICONS,
    resolveBrandValue,
} from "./brand-icons";

describe("brand icon resolver", () => {
    it("auto-matches common language and framework spellings", () => {
        expect(autoMatchBrand("TypeScript")?.title).toBe("TypeScript");
        expect(autoMatchBrand("TypeScript")?.hex).toBe("#3178C6");
        expect(autoMatchBrand("Node.js")?.title).toBe("Node.js");
        expect(autoMatchBrand("C++")?.title).toBe("C++");
        expect(autoMatchBrand("C#")?.title).toBe("C#");
        expect(autoMatchBrand("TeX")?.title).toBe("TeX");
        expect(autoMatchBrand("LaTeX")?.title).toBe("LaTeX");
        expect(autoMatchBrand("PowerShell")?.title).toBe("PowerShell");
        expect(autoMatchBrand("Batch file")?.title).toBe("Batchfile");
        expect(autoMatchBrand("CMake")?.title).toBe("CMake");
        expect(autoMatchBrand("Nushell")?.title).toBe("Nushell");
        expect(autoMatchBrand("fish shell")?.title).toBe("fish shell");
        expect(autoMatchBrand("Zsh")?.title).toBe("Zsh");
        expect(autoMatchBrand("Ninja build")?.title).toBe("Ninja");
        expect(autoMatchBrand("Tailwind")?.title).toBe("Tailwind CSS");
        expect(autoMatchBrand("Postgres")?.title).toBe("PostgreSQL");
    });

    it("uses token fallbacks for high-value brands unavailable from simple-icons", () => {
        const csharp = autoMatchBrand("C#");
        const aws = autoMatchBrand("Amazon Web Services");

        expect(csharp?.title).toBe("C#");
        expect(csharp?.hex).toBe("#512BD4");
        expect(aws?.title).toBe("AWS");
        expect(aws?.hex).toBe("#FF9900");
    });

    it("best-effort matches names embedded in longer skill labels", () => {
        expect(autoMatchBrand("React Native mobile apps")?.title).toBe("React");
        expect(autoMatchBrand("C# / .NET backend")?.title).toBe("C#");
        expect(autoMatchBrand("LaTeX resume templates")?.title).toBe("LaTeX");
        expect(autoMatchBrand("Windows batch scripting")?.title).toBe("Batchfile");
        expect(autoMatchBrand("CI/CD pipelines")?.title).toBe("GitHub Actions");
        expect(autoMatchBrand("OpenAPI REST APIs")?.title).toBe("OpenAPI Initiative");
    });

    it("resolves explicit picker values and ignores non-brand icon values", () => {
        expect(resolveBrandValue("brand:react")?.title).toBe("React");
        expect(resolveBrandValue("brand:python")?.title).toBe("Python");
        expect(resolveBrandValue("brand:csharp")?.title).toBe("C#");
        expect(resolveBrandValue("brand:powershell")?.title).toBe("PowerShell");
        expect(resolveBrandValue("brand:batchfile")?.title).toBe("Batchfile");
        expect(resolveBrandValue("github")).toBeNull();
        expect(resolveBrandValue("brand:not-real")).toBeNull();
    });

    it("exposes sorted picker choices with stable brand values", () => {
        expect(BRAND_ICON_CHOICES).toContainEqual({ value: "brand:typescript", label: "TypeScript" });
        expect(BRAND_ICON_CHOICES).toContainEqual({ value: "brand:react", label: "React" });
        expect(BRAND_ICON_CHOICES).toContainEqual({ value: "brand:csharp", label: "C#" });
        expect(BRAND_ICON_CHOICES).toContainEqual({ value: "brand:latex", label: "LaTeX" });
        expect(BRAND_ICON_CHOICES).toContainEqual({ value: "brand:powershell", label: "PowerShell" });
        expect(BRAND_ICON_CHOICES).toEqual(
            [...BRAND_ICON_CHOICES].sort((a, b) => a.label.localeCompare(b.label))
        );
    });

    it("recognises the technologies reported as missing, under their usual spellings", () => {
        const expected: Record<string, string> = {
            Java: "OpenJDK", OpenJDK: "OpenJDK", HTML: "HTML5", HTML5: "HTML5", SCSS: "Sass", Sass: "Sass",
            HCL: "HashiCorp", Jinja: "Jinja", Jinja2: "Jinja", Dockerfile: "Docker", WebGPU: "WebGPU", wgpu: "wgpu",
            Tailscale: "Tailscale", NetworkX: "NetworkX", MPI: "MPI", OpenMPI: "MPI", Valkey: "Valkey",
            NeoForge: "NeoForge", Fabric: "Fabric", "Minecraft Forge": "Minecraft Forge", Forge: "Minecraft Forge", SimPy: "SimPy",
        };
        for (const [name, title] of Object.entries(expected)) {
            expect(autoMatchBrand(name)?.title, name).toBe(title);
        }
    });

    it("does not let the new short names claim unrelated words", () => {
        expect(autoMatchBrand("JavaScript")?.title).toBe("JavaScript");
        expect(autoMatchBrand("Prototyping")).toBeNull();
        expect(autoMatchBrand("User Research")).toBeNull();
    });

    it("every registered icon has a title, a component and a usable colour", () => {
        for (const [key, icon] of Object.entries(BRAND_ICONS)) {
            expect(icon.title, key).toBeTruthy();
            expect(icon.Comp, key).toBeTruthy();
            if (icon.hex !== null) expect(icon.hex, key).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
    });
});
