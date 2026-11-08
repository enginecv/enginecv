import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { createId } from "@/lib/id";
import { createEmptyResume, resumeSchema } from "@/lib/schema";
import { CefrAssessmentPanel } from "./CefrAssessmentPanel";

async function rate(user: ReturnType<typeof userEvent.setup>, skill: string, level: string) {
    await user.click(within(screen.getByTestId(`cefr-skill-${skill}`)).getByRole("radio", { name: new RegExp(`^${level}`) }));
}

async function answerGerman(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByTestId("cefr-language"), "German");
    await rate(user, "listening", "B2");
    await rate(user, "reading", "B2");
    await rate(user, "spokenInteraction", "B1");
    await rate(user, "spokenProduction", "B1");
}

describe("CefrAssessmentPanel", () => {
    beforeEach(async () => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
        await db.resumes.clear();
        await db.resumeHistory.clear();
    });

    afterEach(async () => {
        cleanup();
        await db.resumes.clear();
        await db.resumeHistory.clear();
    });

    it("waits for a language and one rated skill before showing a result", async () => {
        const user = userEvent.setup();
        render(<CefrAssessmentPanel onDone={vi.fn()} labelledBy="t" />);

        const show = screen.getByTestId("cefr-show-result");
        expect(show).toBeDisabled();
        await user.type(screen.getByTestId("cefr-language"), "German");
        expect(show).toBeDisabled();
        await rate(user, "reading", "A2");
        expect(show).toBeEnabled();
    });

    it("shows a partial result, names the skipped skill and can go back to the answers", async () => {
        const user = userEvent.setup();
        render(<CefrAssessmentPanel onDone={vi.fn()} labelledBy="t" />);

        await answerGerman(user);
        await user.click(screen.getByTestId("cefr-show-result"));

        expect(screen.getByTestId("cefr-overall")).toHaveTextContent("Overall: B1 (Independent user)");
        expect(screen.getByTestId("cefr-result-listening")).toHaveTextContent("B2");
        expect(screen.queryByTestId("cefr-result-writing")).not.toBeInTheDocument();
        expect(screen.getByTestId("cefr-skipped")).toHaveTextContent("Not rated: Writing");

        await user.click(screen.getByRole("button", { name: "Change answers" }));
        expect(screen.getByTestId("cefr-language")).toHaveValue("German");
    });

    it("creates a new CV straight away when there is none", async () => {
        const user = userEvent.setup();
        const onDone = vi.fn();
        render(<CefrAssessmentPanel onDone={onDone} labelledBy="t" />);

        await answerGerman(user);
        await user.click(screen.getByTestId("cefr-show-result"));
        await user.click(screen.getByTestId("cefr-add-to-cv"));

        await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
        const [saved] = await db.resumes.toArray();
        expect(onDone).toHaveBeenCalledWith(saved.id);
        expect(saved.languages[0]).toMatchObject({ language: "German", fluency: "B1", cefrDetailed: true });
        expect(screen.queryByTestId("cefr-choose-cv")).not.toBeInTheDocument();
    });

    it("asks which CV when there are some, and explains a mother-tongue match", async () => {
        const user = userEvent.setup();
        const onDone = vi.fn();
        const id = createId();
        const base = createEmptyResume();
        await db.resumes.add(resumeSchema.parse({
            ...base,
            id,
            createdAt: 1,
            updatedAt: 1,
            meta: { ...base.meta, title: "Berlin applications" },
            languages: [{ language: "German", fluency: "Native" }],
        }));
        render(<CefrAssessmentPanel onDone={onDone} labelledBy="t" />);

        await answerGerman(user);
        await user.click(screen.getByTestId("cefr-show-result"));
        await user.click(screen.getByTestId("cefr-add-to-cv"));

        const chooser = await screen.findByTestId("cefr-choose-cv");
        await user.click(within(chooser).getByRole("radio", { name: "Berlin applications" }));
        await user.click(screen.getByTestId("cefr-confirm-target"));

        expect(await screen.findByTestId("cefr-notice")).toHaveTextContent("mother tongue");
        expect(onDone).not.toHaveBeenCalled();

        await user.click(within(screen.getByTestId("cefr-choose-cv")).getByRole("radio", { name: "A new CV" }));
        await user.click(screen.getByTestId("cefr-confirm-target"));
        await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
        expect(await db.resumes.count()).toBe(2);
    });

    it("shows the statements in German on a German page", () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<CefrAssessmentPanel onDone={vi.fn()} labelledBy="t" />);

        expect(within(screen.getByTestId("cefr-skill-listening")).getByText("Hören")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Mein Niveau anzeigen" })).toBeInTheDocument();
    });
});
