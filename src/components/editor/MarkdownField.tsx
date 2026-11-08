"use client";

import { cloneElement, isValidElement, type ReactElement } from "react";
import dynamic from "next/dynamic";
import { commands, type ICommand } from "@uiw/react-md-editor";
import { useTranslation } from "@/lib/i18n";
import { toggleMarkdownList, type MarkdownListKind } from "@/lib/markdown-lists";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

function listCommand(base: ICommand, kind: MarkdownListKind): ICommand {
    return {
        ...base,
        execute: (state, api) => {
            const result = toggleMarkdownList(state.text, state.selection, kind);
            const lineStart = result.selection.start;
            const originalLineEnd = state.text.indexOf("\n", state.selection.end);
            api.setSelectionRange({
                start: lineStart,
                end: originalLineEnd === -1 ? state.text.length : originalLineEnd,
            });
            api.replaceSelection(result.text.slice(
                lineStart,
                result.text.length - (state.text.length - (originalLineEnd === -1 ? state.text.length : originalLineEnd)),
            ));
            api.setSelectionRange(result.selection);
        },
    };
}

/** Toolbar buttons are already named; their SVG icons are decoration for screen readers. */
function withDecorativeIcon(command: ICommand): ICommand {
    if (!isValidElement(command.icon)) return command;
    return { ...command, icon: cloneElement(command.icon as ReactElement<Record<string, unknown>>, { "aria-hidden": true, focusable: "false" }) };
}

const TOGGLE_UNORDERED_LIST = listCommand(commands.unorderedListCommand, "bullet");
const TOGGLE_ORDERED_LIST = listCommand(commands.orderedListCommand, "ordered");

const MARKDOWN_EDITOR_STYLES = `
    .md-editor-custom .w-md-editor {
        background-color: var(--surface-1) !important;
        border: 1px solid var(--edge) !important;
        border-radius: 12px !important;
        overflow: hidden;
        box-shadow: none !important;
        --color-border-default: var(--edge) !important;
        --color-fg-default: var(--bright) !important;
        --color-canvas-default: var(--surface-1) !important;
        --color-canvas-subtle: var(--surface-4) !important;
    }
    .md-editor-custom .w-md-editor-toolbar {
        background-color: var(--surface-4) !important;
        border-bottom: 1px solid var(--edge) !important;
        padding: 4px 8px !important;
        min-height: auto !important;
    }
    .md-editor-custom .w-md-editor-toolbar ul > li > button {
        color: var(--dim) !important;
        height: 28px !important;
        width: 28px !important;
    }
    .md-editor-custom .w-md-editor-toolbar ul > li > button:hover,
    .md-editor-custom .w-md-editor-toolbar ul > li > button:focus {
        color: var(--accent) !important;
        background-color: var(--edge) !important;
        border-radius: 6px;
    }
    .md-editor-custom .w-md-editor-toolbar ul > li > button > svg {
        width: 16px !important;
        height: 16px !important;
    }
    .md-editor-custom .w-md-editor-toolbar li.active > button {
        color: var(--accent) !important;
    }
    .md-editor-custom .w-md-editor-toolbar ul > li.w-md-editor-toolbar-divider {
        background-color: var(--edge) !important;
    }
    .md-editor-custom .w-md-editor-text-pre,
    .md-editor-custom .w-md-editor-text-input,
    .md-editor-custom .w-md-editor-text {
        font-size: 13px !important;
        color: var(--bright) !important;
    }
    .md-editor-custom .w-md-editor-text-pre > code {
        font-size: 13px !important;
        color: var(--bright) !important;
    }
    .md-editor-custom .w-md-editor-content {
        background-color: var(--surface-1) !important;
    }
    .md-editor-custom .w-md-editor-input {
        background-color: var(--surface-1) !important;
    }
    .md-editor-custom .w-md-editor-preview {
        background-color: var(--surface-1) !important;
        padding: 12px 16px !important;
    }
    .md-editor-custom .wmde-markdown {
        background-color: var(--surface-1) !important;
        color: var(--bright) !important;
        font-size: 13px !important;
    }
    .md-editor-custom .wmde-markdown a {
        color: var(--accent) !important;
    }
    .md-editor-custom .wmde-markdown strong {
        color: var(--strong) !important;
    }
    .md-editor-custom .wmde-markdown hr {
        border-color: var(--edge) !important;
    }
    .md-editor-custom .w-md-editor-bar {
        background-color: var(--surface-4) !important;
        right: 8px !important;
    }
    .md-editor-custom .w-md-editor-bar svg {
        color: var(--faint) !important;
    }
    .md-editor-custom .w-md-editor:focus-within {
        border-color: var(--faint) !important;
    }
    .md-editor-custom .w-md-editor-toolbar ul > li:has(button[data-name="fullscreen"]) {
        display: none !important;
    }
`;

/**
 * The Markdown editor used for every rich-text field in the editor sidebar
 * (entry descriptions, the summary): toolbar with localized labels, list
 * toggles, and the app's theme tokens.
 */
export function MarkdownField({
    value,
    onChange,
    labelledBy,
    height = 180,
    textareaProps,
}: {
    value: string;
    onChange: (value: string) => void;
    /** Id of the visible label, so the textarea has an accessible name. */
    labelledBy: string;
    height?: number;
    textareaProps?: { placeholder?: string; "data-testid"?: string };
}) {
    const { t } = useTranslation();

    const localizeCommand = (command: ICommand): ICommand => {
        const decorated = withDecorativeIcon(command);
        if (!command.buttonProps || !command.name) return decorated;
        const label = t(`markdown.${command.name}`);
        return { ...decorated, buttonProps: { ...command.buttonProps, title: label, "aria-label": label } };
    };

    const editorCommands = [
        commands.bold,
        commands.italic,
        commands.strikethrough,
        commands.divider,
        TOGGLE_UNORDERED_LIST,
        TOGGLE_ORDERED_LIST,
        commands.divider,
        commands.link,
        commands.quote,
        commands.code,
    ].map(localizeCommand);

    const editorExtraCommands = [
        commands.codeEdit,
        commands.codeLive,
        commands.codePreview,
    ].map(localizeCommand);

    return (
        <div data-color-mode="dark" className="md-editor-custom">
            <style>{MARKDOWN_EDITOR_STYLES}</style>
            <MDEditor
                value={value}
                onChange={(next) => onChange(next || "")}
                height={height}
                preview="edit"
                hideToolbar={false}
                visibleDragbar={true}
                commands={editorCommands}
                extraCommands={editorExtraCommands}
                textareaProps={{ ...textareaProps, "aria-labelledby": labelledBy }}
            />
        </div>
    );
}
