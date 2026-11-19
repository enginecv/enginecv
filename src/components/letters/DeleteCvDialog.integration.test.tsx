import { act, cleanup, fireEvent, render, screen, within, configure } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { makeLetter, makeSentLetter } from "../../../test/setup/letter-fixtures";
import { CopyLettersDialog } from "./CopyLettersDialog";
import { DeleteCvDialog } from "./DeleteCvDialog";

// Database-backed UI: give async queries room when the machine is busy.
configure({ asyncUtilTimeout: 4000 });

const otherCvs = [{ id: "cv-2", label: "Research CV" }, { id: "cv-3", label: "Design CV" }];

function renderDialog(letters = [makeLetter({ id: "d1", company: "Acme" }), makeLetter({ id: "d2", company: "Globex" }), makeSentLetter({ id: "s1" })], props: Partial<Parameters<typeof DeleteCvDialog>[0]> = {}) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<DeleteCvDialog cvName="Old CV" letters={letters} otherCvs={otherCvs} busy={false} error={false} onConfirm={onConfirm} onCancel={onCancel} {...props} />);
    return { onConfirm, onCancel };
}

describe("DeleteCvDialog", () => {
    beforeEach(() => act(() => useI18nStore.setState({ locale: "en", _hydrated: true })));
    afterEach(cleanup);

    it("says how many letters are linked, that none is deleted, and that sent ones need no choice", () => {
        renderDialog();
        expect(screen.getByTestId("delete-cv-summary")).toHaveTextContent("(3)");
        expect(screen.getByTestId("delete-cv-summary")).toHaveTextContent("None of them will be deleted");
        expect(screen.getByTestId("delete-cv-frozen")).toHaveTextContent("(1)");
        expect(screen.getAllByTestId("delete-cv-draft")).toHaveLength(2);
    });

    it("keeps the delete button off until every draft has an answer", () => {
        const { onConfirm } = renderDialog();
        const confirm = screen.getByTestId("delete-cv-confirm");
        expect(confirm).toBeDisabled();

        fireEvent.change(screen.getByTestId("delete-choice-d1"), { target: { value: "link:cv-2" } });
        expect(confirm).toBeDisabled();
        fireEvent.change(screen.getByTestId("delete-choice-d2"), { target: { value: "snapshot" } });
        expect(confirm).toBeEnabled();

        fireEvent.click(confirm);
        expect(onConfirm).toHaveBeenCalledWith([{ letterId: "d1", action: "link", cvId: "cv-2" }, { letterId: "d2", action: "snapshot" }]);
    });

    it("applies one choice to every draft with 'same for all'", () => {
        const { onConfirm } = renderDialog();
        fireEvent.change(screen.getByTestId("delete-choice-all"), { target: { value: "link:cv-3" } });
        expect(screen.getByTestId("delete-choice-d1")).toHaveValue("link:cv-3");
        expect(screen.getByTestId("delete-choice-d2")).toHaveValue("link:cv-3");
        fireEvent.click(screen.getByTestId("delete-cv-confirm"));
        expect(onConfirm).toHaveBeenCalledWith([{ letterId: "d1", action: "link", cvId: "cv-3" }, { letterId: "d2", action: "link", cvId: "cv-3" }]);
    });

    it("needs no answers when every letter is already sent or frozen", () => {
        const { onConfirm } = renderDialog([makeSentLetter({ id: "s1" }), makeSentLetter({ id: "s2" })]);
        expect(screen.queryByTestId("delete-cv-draft")).toBeNull();
        fireEvent.click(screen.getByTestId("delete-cv-confirm"));
        expect(onConfirm).toHaveBeenCalledWith([]);
    });

    it("offers only the snapshot when there is no other CV to follow", () => {
        renderDialog([makeLetter({ id: "d1" })], { otherCvs: [] });
        const options = within(screen.getByTestId("delete-choice-d1")).getAllByRole("option");
        expect(options.map((option) => option.getAttribute("value"))).toEqual(["", "snapshot"]);
    });

    it("cancels without confirming, and shows a failure plainly", () => {
        const { onCancel, onConfirm } = renderDialog(undefined, { error: true });
        expect(screen.getByTestId("delete-cv-error")).toHaveTextContent("Nothing was deleted");
        fireEvent.click(screen.getByTestId("delete-cv-cancel"));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });
});

describe("CopyLettersDialog", () => {
    beforeEach(() => act(() => useI18nStore.setState({ locale: "en", _hydrated: true })));
    afterEach(cleanup);

    it("offers a copy of the letters or just the CV", () => {
        const onCopy = vi.fn();
        const onSkip = vi.fn();
        render(<CopyLettersDialog count={3} busy={false} error={false} onCopy={onCopy} onSkip={onSkip} />);
        expect(screen.getByTestId("copy-letters-dialog")).toHaveTextContent("(3)");
        fireEvent.click(screen.getByTestId("copy-letters-copy"));
        fireEvent.click(screen.getByTestId("copy-letters-skip"));
        expect(onCopy).toHaveBeenCalledTimes(1);
        expect(onSkip).toHaveBeenCalledTimes(1);
    });
});
