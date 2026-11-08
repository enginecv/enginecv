import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Bot, Download, Save, SlidersHorizontal, Sun, Type } from "lucide-react";
import { useI18nStore } from "@/lib/i18n";
import { clientPreferencesSchema } from "@/lib/preferences/schema";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { CommandPalette, type CommandAction } from "./CommandPalette";

function buildActions(overrides: Partial<CommandAction>[] = []): CommandAction[] {
    const base: CommandAction[] = [
        {
            id: "save",
            group: "File",
            label: "Save",
            icon: Save,
            shortcut: "Ctrl+S",
            keywords: ["write"],
            run: vi.fn(),
        },
        {
            id: "export",
            group: "File",
            label: "Export",
            icon: Download,
            keywords: ["pdf", "download"],
            run: vi.fn(),
        },
        {
            id: "chat",
            group: "View",
            label: "AI chat",
            icon: Bot,
            checked: false,
            run: vi.fn(),
        },
    ];

    return base.map((action, index) => ({ ...action, ...(overrides[index] ?? {}) }));
}

describe("CommandPalette", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
        useClientPreferencesStore.setState({
            preferences: clientPreferencesSchema.parse({}),
            hydrated: true,
        });
    });

    afterEach(() => {
        cleanup();
    });

    it("renders nothing while closed", () => {
        render(<CommandPalette open={false} onClose={() => {}} actions={buildActions()} />);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows root sections and drills into their commands", async () => {
        const user = userEvent.setup();
        render(<CommandPalette open onClose={() => {}} actions={buildActions()} />);

        expect(screen.getByText("Commands")).toBeInTheDocument();
        expect(screen.getByText("File")).toBeInTheDocument();
        expect(screen.getByText("View")).toBeInTheDocument();
        expect(screen.queryByText("Save")).not.toBeInTheDocument();

        await user.click(screen.getByText("File"));

        expect(screen.getByText("Save")).toBeInTheDocument();
        expect(screen.getByText("Ctrl+S")).toBeInTheDocument();
        expect(screen.queryByText("AI chat")).not.toBeInTheDocument();
    });

    it("filters by keyword, not just by label", async () => {
        const user = userEvent.setup();
        render(<CommandPalette open onClose={() => {}} actions={buildActions()} />);

        await user.type(screen.getByRole("combobox"), "pdf");

        await waitFor(() => expect(screen.queryByText("Save")).not.toBeInTheDocument());
        expect(screen.getByText("Export")).toBeInTheDocument();
    });

    it("finds and runs a deeply nested leaf from the root search", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const runLightTheme = vi.fn();
        const actions: CommandAction[] = [{
            id: "preferences",
            group: "Preferences",
            label: "Preferences",
            icon: SlidersHorizontal,
            children: [{
                id: "theme",
                group: "Appearance",
                label: "Theme",
                icon: SlidersHorizontal,
                keywords: ["appearance"],
                children: [{
                    id: "theme-light",
                    group: "Theme",
                    label: "Light",
                    icon: Sun,
                    run: runLightTheme,
                }],
            }],
        }];
        render(<CommandPalette open onClose={onClose} actions={actions} />);

        await user.type(screen.getByRole("combobox"), "light");

        expect(screen.getByText("Light")).toBeInTheDocument();
        expect(screen.getByText("Preferences › Theme")).toBeInTheDocument();
        await user.click(screen.getByText("Light"));
        expect(runLightTheme).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("matches nested leaves through ancestor keywords", async () => {
        const user = userEvent.setup();
        const actions: CommandAction[] = [{
            id: "preferences",
            group: "Preferences",
            label: "Preferences",
            icon: SlidersHorizontal,
            children: [{
                id: "theme",
                group: "Appearance",
                label: "Theme",
                icon: SlidersHorizontal,
                keywords: ["appearance"],
                children: [{
                    id: "theme-light",
                    group: "Theme",
                    label: "Light",
                    icon: Sun,
                    run: vi.fn(),
                }],
            }],
        }];
        render(<CommandPalette open onClose={() => {}} actions={actions} />);

        await user.type(screen.getByRole("combobox"), "appearance");

        expect(screen.getByText("Light")).toBeInTheDocument();
    });

    it("shows the empty state with the query when nothing matches", async () => {
        const user = userEvent.setup();
        render(<CommandPalette open onClose={() => {}} actions={buildActions()} />);

        await user.type(screen.getByRole("combobox"), "zzzz");

        await waitFor(() =>
            expect(screen.getByText('Nothing matches “zzzz”.')).toBeInTheDocument(),
        );
    });

    it("runs the action and closes on Enter", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const actions = buildActions();
        render(<CommandPalette open onClose={onClose} actions={actions} />);

        await user.type(screen.getByRole("combobox"), "export");
        await waitFor(() => expect(screen.getByText("Export")).toBeInTheDocument());
        await user.keyboard("{Enter}");

        expect(actions[1].run).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(actions[0].run).not.toHaveBeenCalled();
    });

    it("reports the exact leaf action after execution", async () => {
        const user = userEvent.setup();
        const onRunAction = vi.fn();
        const actions = buildActions();
        render(
            <CommandPalette
                open
                onClose={() => {}}
                actions={actions}
                onRunAction={onRunAction}
            />,
        );

        await user.type(screen.getByRole("combobox"), "export");
        await user.keyboard("{Enter}");

        expect(onRunAction).toHaveBeenCalledWith(actions[1]);
    });

    it("opens nested command pages and runs a leaf action", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const runTypography = vi.fn();
        const actions: CommandAction[] = [
            ...buildActions(),
            {
                id: "customize",
                group: "Go to",
                label: "Customize",
                icon: SlidersHorizontal,
                childrenPlaceholder: "Search customization...",
                children: [{
                    id: "typography",
                    group: "Appearance",
                    label: "Typography",
                    icon: Type,
                    keywords: ["font"],
                    run: runTypography,
                }],
            },
        ];
        render(<CommandPalette open onClose={onClose} actions={actions} />);

        await user.type(screen.getByRole("combobox"), "customize");
        await user.keyboard("{Enter}");

        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByText("Commands")).toBeInTheDocument();
        expect(screen.getByText("Appearance")).toBeInTheDocument();
        expect(screen.getByRole("combobox")).toHaveValue("");
        expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "Search customization...");

        await user.type(screen.getByRole("combobox"), "font");
        await user.keyboard("{Enter}");

        expect(runTypography).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("returns from a nested page before Escape closes the palette", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const actions: CommandAction[] = [{
            id: "customize",
            group: "Go to",
            label: "Customize",
            icon: SlidersHorizontal,
            children: [{
                id: "typography",
                group: "Appearance",
                label: "Typography",
                icon: Type,
                run: vi.fn(),
            }],
        }];
        render(<CommandPalette open onClose={onClose} actions={actions} />);

        await user.keyboard("{Enter}{Enter}");
        fireEvent.keyDown(document, { key: "Escape" });

        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByText("Customize")).toBeInTheDocument();

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByText("Go to")).toBeInTheDocument();

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("never runs a disabled action", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const actions = buildActions([{ disabled: true }]);
        render(<CommandPalette open onClose={onClose} actions={actions} />);

        await user.type(screen.getByRole("combobox"), "save");
        await user.keyboard("{Enter}");

        expect(actions[0].run).not.toHaveBeenCalled();
    });

    it("starts from an empty query after being closed and reopened", async () => {
        const user = userEvent.setup();
        const { rerender } = render(
            <CommandPalette open onClose={() => {}} actions={buildActions()} />,
        );

        await user.type(screen.getByRole("combobox"), "pdf");
        await waitFor(() => expect(screen.queryByText("Save")).not.toBeInTheDocument());

        rerender(<CommandPalette open={false} onClose={() => {}} actions={buildActions()} />);
        rerender(<CommandPalette open onClose={() => {}} actions={buildActions()} />);

        expect(screen.getByRole("combobox")).toHaveValue("");
        expect(screen.getByText("File")).toBeInTheDocument();
        expect(screen.queryByText("Save")).not.toBeInTheDocument();
    });

    it("closes on Escape and on a backdrop click", () => {
        const onClose = vi.fn();
        const { container } = render(
            <CommandPalette open onClose={onClose} actions={buildActions()} />,
        );

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);

        fireEvent.click(container.querySelector(".backdrop-blur-md")!);
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("translates its own chrome into the active locale", () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<CommandPalette open onClose={() => {}} actions={buildActions()} />);

        expect(screen.getByPlaceholderText("Nach einer Aktion suchen…")).toBeInTheDocument();
        expect(screen.getByRole("dialog")).toHaveAccessibleName("Befehlspalette");
    });

    it("anchors mobile mode to the top of the viewport", () => {
        render(
            <CommandPalette
                open
                onClose={() => {}}
                actions={buildActions()}
                variant="sheet"
            />,
        );

        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAttribute("data-variant", "sheet");
        expect(dialog).toHaveAttribute("data-placement", "top");
        expect(dialog).toHaveClass("rounded-b-xl");
        expect(dialog.parentElement).toHaveClass("items-start");
    });

    it("applies saved width and height options", () => {
        useClientPreferencesStore.getState().updateSection("commandPalette", {
            width: "wide",
            height: "tall",
        });

        render(<CommandPalette open onClose={() => {}} actions={buildActions()} />);

        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAttribute("data-width", "wide");
        expect(dialog).toHaveAttribute("data-height", "tall");
        expect(dialog).toHaveClass("max-w-3xl");
        expect(dialog.querySelector("[cmdk-list]")).toHaveClass(
            "max-h-[min(34rem,72vh)]",
        );
    });

    it("refreshes actions while viewing a nested page", async () => {
        const user = userEvent.setup();
        const nestedActions = (status: string): CommandAction[] => [{
            id: "preferences",
            group: "Go to",
            label: "Preferences",
            icon: SlidersHorizontal,
            children: [{
                id: "auto-save",
                group: "Editor",
                label: "Auto Save",
                icon: Save,
                status,
                closeOnRun: false,
                run: vi.fn(),
            }],
        }];
        const { rerender } = render(
            <CommandPalette open onClose={() => {}} actions={nestedActions("Off")} />,
        );

        await user.keyboard("{Enter}{Enter}");
        expect(screen.getByText("Off")).toBeInTheDocument();

        rerender(
            <CommandPalette open onClose={() => {}} actions={nestedActions("On")} />,
        );

        expect(screen.getByText("On")).toBeInTheDocument();
        expect(screen.queryByText("Off")).not.toBeInTheDocument();
    });
});
