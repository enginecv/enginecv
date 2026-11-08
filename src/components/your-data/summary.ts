import type { Inventory } from "@/lib/storage-registry/inventory";
import type { StorageTranslate } from "@/lib/storage-registry/messages";

/** "3 CVs", "2 saved versions", … for the page summary and the delete dialog. */
export function summaryParts(inventory: Inventory, ts: StorageTranslate): string[] {
    const { resumes, versions, templates, other } = inventory.counts;
    return [
        ts("yourData.summary.resumes", { count: resumes }),
        ts("yourData.summary.versions", { count: versions }),
        ts("yourData.summary.templates", { count: templates }),
        ts("yourData.summary.other", { count: other }),
    ];
}
