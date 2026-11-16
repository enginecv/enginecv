import type { ReactNode } from "react";

/**
 * Shared frame for the explanatory diagrams: a captioned figure that reads in
 * order for screen readers (the visual order is the reading order) and stacks
 * on narrow screens. Diagrams carry meaning in text and icons, never colour alone.
 */
export function DiagramFrame({ caption, testId, children }: { caption: string; testId: string; children: ReactNode }) {
    return (
        <figure className="my-2 rounded-2xl border border-edge bg-surface-1 p-4 sm:p-6" data-testid={testId}>
            <figcaption className="mb-4 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.16em] text-faint">
                {caption}
            </figcaption>
            {children}
        </figure>
    );
}

/** A titled box in a diagram. */
export function Zone({
    title,
    tag,
    tone = "plain",
    icon,
    children,
    testId,
}: {
    title: string;
    tag?: string;
    tone?: "plain" | "accent" | "warn";
    icon: ReactNode;
    children: ReactNode;
    testId?: string;
}) {
    const toneClass = tone === "accent"
        ? "border-accent/40 bg-accent/5"
        : tone === "warn"
            ? "border-dashed border-edge-strong bg-surface-2"
            : "border-edge bg-surface-2";
    return (
        <section className={`flex min-w-0 flex-col rounded-xl border p-4 ${toneClass}`} data-testid={testId}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-strong">
                <span className="text-accent" aria-hidden="true">{icon}</span>
                <span className="min-w-0 flex-1">{title}</span>
                {tag && (
                    <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-mid">
                        {tag}
                    </span>
                )}
            </h3>
            {children}
        </section>
    );
}

/** One line in a zone: an icon, text and optional technical name. */
export function Item({ icon, children, code }: { icon: ReactNode; children: ReactNode; code?: string }) {
    return (
        <li className="flex items-start gap-2 text-sm leading-6 text-bright">
            <span className="mt-1 shrink-0" aria-hidden="true">{icon}</span>
            <span className="min-w-0">
                {children}
                {code && <code className="mt-0.5 block break-words font-[family-name:var(--font-geist-mono)] text-[11px] text-mid">{code}</code>}
            </span>
        </li>
    );
}

/** A connector between boxes: right on wide screens, down on narrow ones. */
export function Connector({ label, both = false }: { label?: string; both?: boolean }) {
    return (
        <div className="flex shrink-0 items-center justify-center gap-1 text-faint lg:flex-col" aria-hidden="true">
            <svg className="h-6 w-6 rotate-90 lg:rotate-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {both ? (
                    <>
                        <path d="M4 12h16" />
                        <path d="M8 8l-4 4 4 4" />
                        <path d="M16 8l4 4-4 4" />
                    </>
                ) : (
                    <>
                        <path d="M4 12h16" />
                        <path d="M14 6l6 6-6 6" />
                    </>
                )}
            </svg>
            {label && <span className="max-w-[7rem] text-center text-[10px] font-medium uppercase leading-tight tracking-wide">{label}</span>}
        </div>
    );
}
