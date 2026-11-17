"use client";

import type { ReactNode } from "react";
import { reportAffiliateClick } from "@/lib/analytics/export-event";
import { resourceLinkRel, type ExternalResource } from "@/lib/resources";

/** An outbound resource link. A partner link also counts the click (link id only). */
export function ResourceAnchor({ link, className, children }: { link: ExternalResource; className?: string; children: ReactNode }) {
    return (
        <a
            href={link.url}
            target="_blank"
            rel={resourceLinkRel(link)}
            className={className}
            onClick={link.sponsored ? () => reportAffiliateClick(link.id) : undefined}
            onAuxClick={link.sponsored ? () => reportAffiliateClick(link.id) : undefined}
        >
            {children}
        </a>
    );
}
