import { expect, type Page } from "@playwright/test";
import { createQaFullResume } from "../../src/lib/qa/sample-resumes";
import { createCvFromHub } from "./import-hub";
import type { Resume } from "../../src/lib/schema";

export async function savedResume(page: Page): Promise<Resume> {
    return page.evaluate(() => new Promise((resolve, reject) => {
        const open = indexedDB.open("EngineCVDatabase");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const connection = open.result;
            const request = connection.transaction("resumes").objectStore("resumes").get(location.pathname.split("/").pop()!);
            request.onsuccess = () => { resolve(request.result); connection.close(); };
            request.onerror = () => { reject(request.error); connection.close(); };
        };
    }));
}

export async function openJsonFixture(page: Page, openJson = true) {
    await page.goto("/dashboard");
    const fixture = createQaFullResume();
    await page.getByTestId("dashboard-import-resume-input").setInputFiles({ name: "qa.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
    await createCvFromHub(page);
    // The dev-only Next badge overlaps the editor's bottom-left controls.
    await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
    if (openJson) {
        await page.getByTestId("sidebar-tab-json").first().click();
        await expect(page.getByRole("textbox", { name: "CV JSON" })).toBeVisible();
    }
    return savedResume(page);
}

export async function replaceJsonDocument(page: Page, text: string) {
    const editor = page.getByRole("textbox", { name: "CV JSON" });
    await editor.click(); await editor.press("ControlOrMeta+a");
    await page.keyboard.insertText(text);
}
