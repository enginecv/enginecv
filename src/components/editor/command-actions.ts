import type { LucideIcon } from "lucide-react";

export interface CommandAction {
    id: string;
    group: string;
    label: string;
    icon: LucideIcon;
    keywords?: string[];
    shortcut?: string;
    status?: string;
    trailingIcon?: LucideIcon;
    checked?: boolean;
    disabled?: boolean;
    children?: CommandAction[];
    childrenPlaceholder?: string;
    globalSearch?: boolean;
    closeOnRun?: boolean;
    run?: () => void;
}

export interface IndexedCommandAction {
    action: CommandAction;
    path: string[];
    keywords: string[];
}

function appendPath(path: string[], value: string): string[] {
    if (!value || path.at(-1)?.localeCompare(value, undefined, { sensitivity: "accent" }) === 0) {
        return path;
    }
    return [...path, value];
}

function uniqueTerms(terms: string[]): string[] {
    return [...new Set(terms.filter(Boolean))];
}

/**
 * Builds cmdk's flat search index while retaining each command's browse path.
 * Later duplicate IDs win, so canonical actions can follow recent/pinned aliases;
 * search terms from every occurrence remain available.
 */
export function indexCommandActions(
    actions: CommandAction[],
    options: { global?: boolean } = {},
): IndexedCommandAction[] {
    const indexed = new Map<string, IndexedCommandAction>();

    const visit = (
        currentActions: CommandAction[],
        parentPath: string[],
        parentKeywords: string[],
        root: boolean,
    ) => {
        for (const action of currentActions) {
            const path = root ? appendPath(parentPath, action.group) : parentPath;
            const keywords = uniqueTerms([
                action.label,
                action.group,
                ...(action.keywords ?? []),
                ...parentKeywords,
                ...path,
                path.join(" "),
            ]);
            if (!options.global || action.globalSearch !== false) {
                const previous = indexed.get(action.id);

                indexed.set(action.id, {
                    action,
                    path,
                    keywords: uniqueTerms([...(previous?.keywords ?? []), ...keywords]),
                });
            }

            if (action.children?.length) {
                visit(
                    action.children,
                    appendPath(path, action.label),
                    keywords,
                    false,
                );
            }
        }
    };

    visit(actions, [], [], true);
    return [...indexed.values()];
}

export function flattenCommandActions(
    actions: CommandAction[],
    includeContainers = false,
): CommandAction[] {
    return actions.flatMap((action) => [
        ...(includeContainers || !action.children?.length ? [action] : []),
        ...flattenCommandActions(action.children ?? [], includeContainers),
    ]);
}

export function findCommandAction(
    actions: CommandAction[],
    id: string,
): CommandAction | undefined {
    for (const action of actions) {
        if (action.id === id) return action;
        const nested = findCommandAction(action.children ?? [], id);
        if (nested) return nested;
    }
    return undefined;
}

export function mapCommandActions(
    actions: CommandAction[],
    mapper: (action: CommandAction) => CommandAction,
): CommandAction[] {
    return actions.map((action) => mapper({
        ...action,
        children: action.children ? mapCommandActions(action.children, mapper) : undefined,
    }));
}
