import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { translate } from "@/lib/i18n/translate";
import { EditExampleButton } from "./EditExampleButton";

const push = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push, prefetch: vi.fn() }),
    usePathname: () => "/cv-examples/nurse",
}));

async function clear() {
    await db.resumes.clear();
    await db.resumeHistory.clear();
}

describe("EditExampleButton", () => {
    beforeEach(async () => {
        push.mockReset();
        useI18nStore.setState({ locale: "en" });
        await clear();
    });

    afterEach(async () => {
        cleanup();
        vi.restoreAllMocks();
        await clear();
    });

    it("creates a local copy in the page language and opens the editor on it", async () => {
        render(<EditExampleButton roleId="nurse" locale="de" name="Pflegefachkraft" />);
        await userEvent.click(screen.getByTestId("edit-example"));

        await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
        const rows = await db.resumes.toArray();
        expect(rows).toHaveLength(1);
        expect(push).toHaveBeenCalledWith(`/editor/${rows[0].id}`);
        expect(rows[0]).toMatchObject({
            settings: { language: "de" },
            meta: { title: "Example – Pflegefachkraft", tags: ["example"] },
            basics: { headline: expect.stringContaining("Krankenpflegerin") },
        });
        expect(await db.resumeHistory.where("resumeId").equals(rows[0].id as string).count()).toBe(1);
    });

    it("makes a separate copy on every visit and never touches an existing resume", async () => {
        render(<EditExampleButton roleId="software-developer" locale="en" name="Software Developer" />);
        await userEvent.click(screen.getByTestId("edit-example"));
        await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
        const [first] = await db.resumes.toArray();
        cleanup();

        render(<EditExampleButton roleId="software-developer" locale="en" name="Software Developer" />);
        await userEvent.click(screen.getByTestId("edit-example"));
        await waitFor(() => expect(push).toHaveBeenCalledTimes(2));

        const rows = await db.resumes.toArray();
        expect(rows).toHaveLength(2);
        expect(new Set(rows.map((row) => row.id)).size).toBe(2);
        expect(await db.resumes.get(first.id as string)).toEqual(first);
    });

    it("ignores a second press while the first is still running", async () => {
        render(<EditExampleButton roleId="nurse" locale="en" name="Nurse" />);
        const button = screen.getByTestId("edit-example");
        await userEvent.dblClick(button);

        await waitFor(() => expect(push).toHaveBeenCalled());
        expect(await db.resumes.count()).toBe(1);
        expect(push).toHaveBeenCalledTimes(1);
    });

    it("shows an error and creates nothing when storage fails", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(db.resumes, "add").mockRejectedValueOnce(new Error("storage blocked"));

        render(<EditExampleButton roleId="nurse" locale="en" name="Nurse" />);
        await userEvent.click(screen.getByTestId("edit-example"));

        expect(await screen.findByRole("alert")).toHaveTextContent(translate("en", "roleExamples.copyError"));
        expect(push).not.toHaveBeenCalled();
        expect(await db.resumes.count()).toBe(0);
        expect(screen.getByTestId("edit-example")).toBeEnabled();
    });

    it("leaves no half-created resume when the history entry fails, and a retry works", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(db.resumeHistory, "add").mockRejectedValueOnce(new Error("history failed"));

        render(<EditExampleButton roleId="nurse" locale="en" name="Nurse" />);
        await userEvent.click(screen.getByTestId("edit-example"));

        expect(await screen.findByRole("alert")).toBeInTheDocument();
        expect(await db.resumes.count()).toBe(0);

        await userEvent.click(screen.getByTestId("edit-example"));
        await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
        expect(await db.resumes.count()).toBe(1);
    });

    it("reports an unknown role instead of crashing", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        render(<EditExampleButton roleId="nope" locale="en" name="Nope" />);
        await userEvent.click(screen.getByTestId("edit-example"));
        expect(await screen.findByRole("alert")).toBeInTheDocument();
        expect(push).not.toHaveBeenCalled();
    });
});
