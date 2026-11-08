"use client";

import type { Locale } from "@/lib/i18n";
import type { FoundItem } from "@/lib/storage-registry/inventory";
import type { StorageTranslate } from "@/lib/storage-registry/messages";
import { formatBytes, formatDateTime } from "./format";

function purposeKey(item: FoundItem): string {
    if (!item.entry) return "storage.purpose.unknown";
    return item.entry.status === "legacy" ? "storage.purpose.legacy" : `storage.purpose.${item.entry.id}`;
}

export function InventoryTable({ items, ts, locale }: { items: FoundItem[]; ts: StorageTranslate; locale: Locale }) {
    const unknown = ts("yourData.table.unknown");
    return (
        <div className="overflow-x-auto rounded-xl border border-edge bg-surface-1">
            <table className="w-full min-w-[40rem] text-left text-sm" data-testid="your-data-inventory">
                <caption className="sr-only">{ts("yourData.table.title")}</caption>
                <thead className="border-b border-edge text-xs uppercase tracking-wide text-faint">
                    <tr>
                        <th scope="col" className="px-4 py-3 font-medium">{ts("yourData.table.name")}</th>
                        <th scope="col" className="px-4 py-3 font-medium">{ts("yourData.table.purpose")}</th>
                        <th scope="col" className="px-4 py-3 font-medium">{ts("yourData.table.where")}</th>
                        <th scope="col" className="px-4 py-3 font-medium">{ts("yourData.table.owner")}</th>
                        <th scope="col" className="px-4 py-3 font-medium">{ts("yourData.table.retention")}</th>
                        <th scope="col" className="px-4 py-3 text-right font-medium">{ts("yourData.table.size")}</th>
                        <th scope="col" className="px-4 py-3 font-medium">{ts("yourData.table.changed")}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                    {items.map((item) => (
                        <tr key={`${item.location}:${item.database ?? ""}:${item.name}`} data-testid="your-data-row">
                            <th scope="row" className="px-4 py-3 align-top font-mono text-xs font-normal text-strong">
                                <span className="break-all">{item.name}</span>
                                {item.count !== undefined && (
                                    <span className="mt-1 block font-sans text-faint">{ts("yourData.table.rows", { count: item.count })}</span>
                                )}
                                {!item.entry && (
                                    <span className="mt-1 inline-block rounded-full bg-warning-tint px-2 py-0.5 font-sans text-[11px] font-medium text-warning">
                                        {ts("yourData.table.unrecognised")}
                                    </span>
                                )}
                                {item.entry?.status === "legacy" && (
                                    <span className="mt-1 inline-block rounded-full bg-surface-4 px-2 py-0.5 font-sans text-[11px] font-medium text-faint">
                                        {ts("yourData.table.legacy")}
                                    </span>
                                )}
                            </th>
                            <td className="px-4 py-3 align-top text-bright">{ts(purposeKey(item))}</td>
                            <td className="px-4 py-3 align-top text-mid">{ts(`storage.location.${item.location}`)}</td>
                            <td className="px-4 py-3 align-top text-mid">{item.entry ? ts(`storage.owner.${item.entry.owner}`) : unknown}</td>
                            <td className="px-4 py-3 align-top text-mid">{item.entry ? ts(`storage.retention.${item.entry.retention}`) : unknown}</td>
                            <td className="px-4 py-3 text-right align-top tabular-nums text-mid">
                                {item.sizeBytes !== undefined ? formatBytes(item.sizeBytes, locale) : unknown}
                            </td>
                            <td className="px-4 py-3 align-top text-mid">{item.updatedAt ? formatDateTime(item.updatedAt, locale) : unknown}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
