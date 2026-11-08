"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { collectInventory, type Inventory } from "@/lib/storage-registry/inventory";
import { useStorageMessages, type StorageTranslate } from "@/lib/storage-registry/messages";
import { SERVER_STATEMENT_KEYS } from "@/lib/storage-registry/server-statement";
import { formatBytes } from "./format";
import { InventoryTable } from "./InventoryTable";
import { summaryParts } from "./summary";

type Load = { status: "reading" } | { status: "ready"; inventory: Inventory } | { status: "failed" };

export function YourDataContent({ actions }: { actions?: (props: { inventory: Inventory; reload: () => void; ts: StorageTranslate }) => ReactNode }) {
    const { ts, locale } = useStorageMessages();
    const [load, setLoad] = useState<Load>({ status: "reading" });

    const read = useCallback(() => collectInventory()
        .then((inventory) => setLoad({ status: "ready", inventory }))
        .catch(() => setLoad({ status: "failed" })), []);

    useEffect(() => {
        void read();
    }, [read]);

    const reload = useCallback(() => {
        setLoad({ status: "reading" });
        void read();
    }, [read]);

    return (
        <LegalPage eyebrow="EngineCV" title={ts("yourData.title")} description={ts("yourData.intro")}>
            {load.status === "reading" && (
                <p role="status" className="text-mid" data-testid="your-data-reading">{ts("yourData.reading")}</p>
            )}

            {load.status === "failed" && (
                <p role="alert" className="text-danger">{ts("yourData.download.failed", { reason: "" })}</p>
            )}

            {load.status === "ready" && (
                <>
                    <section aria-labelledby="your-data-summary" className="space-y-3">
                        <h2 id="your-data-summary" className="sr-only">{ts("yourData.title")}</h2>
                        {load.inventory.items.length === 0 ? (
                            <p className="rounded-xl border border-edge bg-surface-1 p-5 text-mid" data-testid="your-data-empty">
                                {ts("yourData.empty")}
                            </p>
                        ) : (
                            <ul className="flex flex-wrap gap-2" data-testid="your-data-summary">
                                {summaryParts(load.inventory, ts).map((part) => (
                                    <li key={part} className="rounded-full border border-edge bg-surface-1 px-3 py-1 text-sm text-strong">{part}</li>
                                ))}
                                {load.inventory.totalBytes > 0 && (
                                    <li className="px-1 py-1 text-sm text-faint">
                                        {ts("yourData.summary.size", { size: formatBytes(load.inventory.totalBytes, locale) })}
                                    </li>
                                )}
                            </ul>
                        )}
                        {load.inventory.unreadable.map((location) => (
                            <p key={location} role="note" className="text-sm text-warning">
                                {ts("yourData.unreadable", { location: ts(`storage.location.${location}`) })}
                            </p>
                        ))}
                    </section>

                    {actions?.({ inventory: load.inventory, reload, ts })}

                    {load.inventory.items.length > 0 && (
                        <LegalSection title={ts("yourData.table.title")}>
                            <InventoryTable items={load.inventory.items} ts={ts} locale={locale} />
                        </LegalSection>
                    )}

                    <LegalSection title={ts("yourData.invisible.title")}>
                        <p>{ts("yourData.invisible.intro")}</p>
                        <ul className="list-disc space-y-2 pl-6">
                            {load.inventory.invisible.map((entry) => (
                                <li key={entry.id}>
                                    <code>{entry.name}</code> ({ts(`storage.owner.${entry.owner}`)}): {ts(`storage.purpose.${entry.id}`)}{" "}
                                    <span className="text-mid">{ts(`storage.how.${entry.removable}`)}</span>
                                </li>
                            ))}
                        </ul>
                    </LegalSection>
                </>
            )}

            <LegalSection title={ts("yourData.server.title")}>
                <ul className="list-disc space-y-2 pl-6">
                    {SERVER_STATEMENT_KEYS.map((key) => <li key={key}>{ts(key)}</li>)}
                </ul>
                <p>
                    <Link href="/contact" className="underline">{ts("yourData.server.contactLink")}</Link>
                </p>
            </LegalSection>
        </LegalPage>
    );
}
