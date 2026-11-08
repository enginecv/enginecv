"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

type IntentPrefetchLinkProps = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string };

/**
 * A link from a content page to a route with heavy JavaScript (the app, the
 * template gallery). Viewport prefetch would download that JavaScript while
 * the page is still painting, so prefetch only once the visitor shows intent.
 */
export function IntentPrefetchLink({ href, onMouseEnter, onFocus, onTouchStart, ...props }: IntentPrefetchLinkProps) {
    const router = useRouter();
    const prefetch = () => router.prefetch(href);

    return (
        <Link
            {...props}
            href={href}
            prefetch={false}
            onMouseEnter={(event) => {
                prefetch();
                onMouseEnter?.(event);
            }}
            onFocus={(event) => {
                prefetch();
                onFocus?.(event);
            }}
            onTouchStart={(event) => {
                prefetch();
                onTouchStart?.(event);
            }}
        />
    );
}
