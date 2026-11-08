import { Download, FileText, Settings } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import {
    findCommandAction,
    flattenCommandActions,
    indexCommandActions,
    mapCommandActions,
    type CommandAction,
} from "./command-actions";

const actions: CommandAction[] = [{
    id: "content",
    group: "Go to",
    label: "Content",
    icon: FileText,
    children: [{
        id: "content-experience",
        group: "Sections",
        label: "Experience",
        icon: Settings,
        run: vi.fn(),
    }],
}, {
    id: "export",
    group: "File",
    label: "Export",
    icon: Download,
    run: vi.fn(),
}];

describe("command action tree", () => {
    it("flattens leaf actions without duplicating containers", () => {
        expect(flattenCommandActions(actions).map((action) => action.id)).toEqual([
            "content-experience",
            "export",
        ]);
    });

    it("finds nested actions by stable id", () => {
        expect(findCommandAction(actions, "content-experience")?.label).toBe("Experience");
        expect(findCommandAction(actions, "missing")).toBeUndefined();
    });

    it("indexes nested actions with inherited labels and browse paths", () => {
        const indexed = indexCommandActions(actions);
        const experience = indexed.find(({ action }) => action.id === "content-experience");

        expect(experience?.path).toEqual(["Go to", "Content"]);
        expect(experience?.keywords).toEqual(expect.arrayContaining([
            "Go to",
            "Content",
            "Sections",
            "Experience",
        ]));
    });

    it("deduplicates repeated commands and prefers their last canonical path", () => {
        const indexed = indexCommandActions([{
            id: "pinned",
            group: "Personal",
            label: "Pinned commands",
            icon: Settings,
            children: [actions[1]],
        }, ...actions]);
        const exports = indexed.filter(({ action }) => action.id === "export");

        expect(exports).toHaveLength(1);
        expect(exports[0].path).toEqual(["File"]);
        expect(exports[0].keywords).toContain("Pinned commands");
    });

    it("omits local-only actions from the global index", () => {
        const localAction: CommandAction = {
            ...actions[1],
            id: "pin-export",
            globalSearch: false,
        };

        expect(indexCommandActions([localAction], { global: true })).toEqual([]);
        expect(indexCommandActions([localAction])).toHaveLength(1);
    });

    it("maps nested actions without mutating source tree", () => {
        const mapped = mapCommandActions(actions, (action) => ({
            ...action,
            status: action.id,
        }));

        expect(mapped[0].children?.[0].status).toBe("content-experience");
        expect(actions[0].children?.[0].status).toBeUndefined();
    });
});
