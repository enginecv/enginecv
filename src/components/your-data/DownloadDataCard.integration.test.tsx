import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importResumeFromJsonText } from "@/lib/export";
import { useI18nStore } from "@/lib/i18n";
import { en } from "@/lib/storage-registry/messages/en";
import { formatStorageMessage } from "@/lib/storage-registry/messages";
import { seededAdapters } from "@/lib/storage-registry/__fixtures__/adapters";
import { DownloadDataCard } from "./DownloadDataCard";

const saved = vi.hoisted(() => ({ blobs: [] as Array<{ blob: Blob; name: string }> }));

vi.mock("@/lib/export", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/export")>();
    return { ...actual, downloadBlob: (blob: Blob, name: string) => saved.blobs.push({ blob, name }) };
});
vi.mock("@/lib/storage-registry/inventory", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/storage-registry/inventory")>();
    return { ...actual, collectInventory: () => actual.collectInventory(seededAdapters()) };
});

const ts = (key: string, params?: Record<string, string | number>) => formatStorageMessage(en, key, params);

async function savedText(): Promise<string> {
    const { blob } = saved.blobs[saved.blobs.length - 1];
    // jsdom's Blob has no text(); FileReader works.
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
    });
}

describe("Download my data", () => {
    beforeEach(() => {
        saved.blobs = [];
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(cleanup);

    it("saves one file with every stored item and the CVs, which import again", async () => {
        render(<DownloadDataCard ts={ts} />);
        fireEvent.click(screen.getByRole("button", { name: /Download my data/ }));

        expect(await screen.findByText(/^Saved enginecv-my-data-\d{4}-\d{2}-\d{2}\.json\.$/)).toBeTruthy();
        const file = JSON.parse(await savedText());
        expect(file.format).toBe("enginecv/data-export");
        expect(file.items.map((item: { name: string }) => item.name)).toEqual(expect.arrayContaining(["resumes", "enginecv-preferences", "foo", "enginecv-locale"]));

        const result = await importResumeFromJsonText(JSON.stringify(file));
        expect(result?.kind === "data-export" && result.resumes).toHaveLength(3);
    });

    it("protects the file with a password the existing import asks for", async () => {
        render(<DownloadDataCard ts={ts} />);
        fireEvent.click(screen.getByLabelText("Protect the file with a password"));
        const button = screen.getByRole("button", { name: /Download my data/ });
        expect((button as HTMLButtonElement).disabled).toBe(true);

        fireEvent.change(screen.getByLabelText("Password"), { target: { value: "s3cret" } });
        fireEvent.click(button);
        await waitFor(() => expect(saved.blobs).toHaveLength(1));

        const text = await savedText();
        expect(JSON.parse(text).format).toBe("enginecv/encrypted-json");
        expect(text).not.toContain("enginecv-preferences");
        const result = await importResumeFromJsonText(text, () => "s3cret");
        expect(result?.kind).toBe("data-export");
    });
});
