import { ClipboardPaste, FileJson, Github, IdCard, Linkedin, Plus, Sparkles, type LucideIcon } from "lucide-react";

/**
 * Every way to start a CV, in display order. The ids double as the public
 * `?start=` link values:
 * never rename one without keeping the old value working.
 */
export const START_PATH_IDS = ["blank", "example", "ai", "linkedin", "europass", "github", "json"] as const;

export type StartPathId = (typeof START_PATH_IDS)[number];

export type StartPath = {
    id: StartPathId;
    icon: LucideIcon;
    titleKey: string;
    /** One line on what the visitor needs for this path. */
    hintKey: string;
    /** Only GitHub import calls a remote API; every other path works offline. */
    needsNetwork: boolean;
};

export function isStartPathId(value: string): value is StartPathId {
    return (START_PATH_IDS as readonly string[]).includes(value);
}

/** Shared by the empty-dashboard start panel and the create dialog. */
export const START_PATHS: readonly StartPath[] = [
    { id: "blank", icon: Plus, titleKey: "dashboard.fromScratch", hintKey: "dashboard.fromScratchDesc", needsNetwork: false },
    { id: "example", icon: Sparkles, titleKey: "onboarding.option.example.title", hintKey: "onboarding.option.example.hint", needsNetwork: false },
    { id: "ai", icon: ClipboardPaste, titleKey: "authoring.entry", hintKey: "authoring.entryDesc", needsNetwork: false },
    { id: "linkedin", icon: Linkedin, titleKey: "linkedinImport.entry", hintKey: "linkedinImport.entryDesc", needsNetwork: false },
    { id: "europass", icon: IdCard, titleKey: "europassImport.entry", hintKey: "europassImport.entryDesc", needsNetwork: false },
    { id: "github", icon: Github, titleKey: "githubImport.entry", hintKey: "githubImport.entryDesc", needsNetwork: true },
    { id: "json", icon: FileJson, titleKey: "dashboard.importJson", hintKey: "dashboard.importJsonDesc", needsNetwork: false },
];
