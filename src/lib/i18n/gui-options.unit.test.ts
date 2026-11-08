import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { commands } from "@uiw/react-md-editor";
import { getLicenseClasses } from "@/lib/driving-license-classes";
import { getBuiltinTemplates } from "@/lib/templates/enginecv-templates";
import { templateDisplayMeta } from "@/lib/templates/template-display";
import { en } from "./en";
import { bs } from "./bs";
import { de } from "./de";
import { fr } from "./fr";
import { es } from "./es";

describe("GUI option dictionaries", () => {
    it.each(Object.entries({ en, bs, de, fr, es }))("%s covers dynamic option labels", (_locale, dictionary) => {
        const lookup = (key: string) => {
            expect(dictionary[key], key).toBeTruthy();
            return dictionary[key];
        };
        for (const country of ["DE", "US", "GB", "CA", "AU"]) {
            for (const category of getLicenseClasses(country)) lookup(category.descriptionKey);
        }
        const source = readFileSync("src/components/editor/FormUtils.tsx", "utf8");
        const icons = source.slice(source.indexOf("const COMMON_ICON_CHOICES"), source.indexOf("// Combined flat list"));
        const brands = new Set(["github", "figma", "chrome", "slack", "twitch", "youtube", "instagram", "facebook", "twitter", "linkedin", "dribbble"]);
        for (const match of icons.matchAll(/value: "([^"]+)"/g)) {
            if (!brands.has(match[1])) lookup(`iconPicker.name.${match[1]}`);
        }
        for (const template of getBuiltinTemplates()) {
            const before = structuredClone(template.meta);
            templateDisplayMeta(template, lookup);
            expect(template.meta).toEqual(before);
        }
        for (const command of [commands.bold, commands.italic, commands.strikethrough, commands.unorderedListCommand,
            commands.orderedListCommand, commands.link, commands.quote, commands.code, commands.codeEdit, commands.codeLive, commands.codePreview]) {
            lookup(`markdown.${command.name}`);
        }
    });

    it("preserves custom template names, descriptions and tags", () => {
        const template = structuredClone(getBuiltinTemplates()[0]);
        template.id = "my-custom-template";
        template.meta.name = "My personal design";
        expect(templateDisplayMeta(template, () => "translated")).toBe(template.meta);
    });
});
