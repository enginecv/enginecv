import { createEmptyResume } from "@/lib/schema";
import { describe, expect, it } from "vitest";
import { getContentEntryTargets } from "./content-entry-targets";

const t = (key: string) => key;

describe("content entry targets", () => {
    it("indexes configured entries with exact section coordinates", () => {
        const resume = createEmptyResume();
        resume.settings.contentSections = ["experience", "education"];
        resume.experience = [{
            id: "exp-1",
            hidden: false,
            position: "Senior Engineer",
            company: "Acme",
            start: "",
            end: "",
            location: "Remote",
            description: "Built a local-first observability platform.",
            highlights: ["Reduced incident response time by 40%."],
            skills: ["Rust", "OpenTelemetry"],
            url: "https://acme.example/careers",
            urlIcon: "auto",
        }];

        const targets = getContentEntryTargets(resume, t);

        expect(targets).toEqual([expect.objectContaining({
            id: "experience:exp-1",
            sectionKey: "experience",
            entryIndex: 0,
            label: "Senior Engineer · Acme",
            description: "Acme · Remote",
        })]);
        expect(targets[0].keywords).toEqual(expect.arrayContaining([
            "Built a local-first observability platform.",
            "Reduced incident response time by 40%.",
            "Rust",
            "OpenTelemetry",
            "https://acme.example/careers",
        ]));
    });

    it("indexes personal details, summary content, and resume metadata", () => {
        const resume = createEmptyResume();
        resume.basics.name = "Safet Imamovic";
        resume.basics.headline = "Rust Engineer";
        resume.basics.summary = "Building Oxide, a native and web 3D rendering engine.";
        resume.basics.emails = [{ id: "email-1", email: "safet@example.com", label: "Primary" }];
        resume.meta.tags = ["graphics", "WebGPU"];

        const target = getContentEntryTargets(resume, t).find(({ id }) => id === "basics");

        expect(target).toEqual(expect.objectContaining({
            sectionKey: "basics",
            entryIndex: null,
            label: "Safet Imamovic",
            description: "Rust Engineer",
        }));
        expect(target?.keywords).toEqual(expect.arrayContaining([
            "Building Oxide, a native and web 3D rendering engine.",
            "safet@example.com",
            "Primary",
            "graphics",
            "WebGPU",
        ]));
    });

    it("indexes text and tag custom sections without manufacturing entries", () => {
        const resume = createEmptyResume();
        resume.settings.contentSections = ["custom:notes", "custom:tools"];
        resume.customSections = [
            {
                id: "notes",
                hidden: false,
                title: "Engineering Notes",
                icon: "auto",
                layout: "text",
                text: "Designed a deterministic render graph for native and web targets.",
                tags: [],
                entries: [],
            },
            {
                id: "tools",
                hidden: false,
                title: "Toolbox",
                icon: "auto",
                layout: "tags",
                text: "",
                tags: ["wgpu", "Bevy"],
                entries: [],
            },
        ];

        const targets = getContentEntryTargets(resume, t);

        expect(targets).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: "custom:notes",
                label: "Engineering Notes",
                description: "Designed a deterministic render graph for native and web targets.",
            }),
            expect.objectContaining({
                id: "custom:tools",
                label: "Toolbox",
                keywords: expect.arrayContaining(["wgpu", "Bevy"]),
            }),
        ]));
    });

    it("does not expose data from sections absent from resume layout", () => {
        const resume = createEmptyResume();
        resume.settings.contentSections = [];
        resume.interests = [{ id: "interest-1", hidden: false, name: "Cycling", description: "" }];

        expect(getContentEntryTargets(resume, t)).toEqual([]);
    });
});
