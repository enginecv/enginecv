import Link from "next/link";
import { GUIDE_COPY } from "@/lib/guides/copy";
import type { GuideMeta } from "@/lib/guides/guides";

/** The hub list. Callers pass published guides only, already in hub order. */
export function GuidesIndex({ guides }: { guides: readonly GuideMeta[] }) {
    return (
        <>
            <header className="max-w-3xl border-b border-edge pb-10">
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-faint">{GUIDE_COPY.hub.eyebrow}</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-strong sm:text-5xl">{GUIDE_COPY.hub.title}</h1>
                <p className="mt-5 text-lg leading-8 text-mid">{GUIDE_COPY.hub.description}</p>
            </header>
            {guides.length === 0 ? (
                <p data-testid="guides-empty" className="mt-10 text-mid">
                    {GUIDE_COPY.hub.empty}
                </p>
            ) : (
                <ul className="mt-10 grid gap-5 sm:grid-cols-2">
                    {guides.map((guide) => (
                        <li key={guide.slug} className="rounded-2xl border border-edge bg-surface-3 p-6">
                            <h2 className="text-xl font-semibold tracking-tight text-strong">
                                <Link href={guide.path} className="hover:text-accent">
                                    {guide.title}
                                </Link>
                            </h2>
                            <p className="mt-3 text-sm leading-7 text-mid">{guide.description}</p>
                            <p className="mt-4 text-xs text-faint">{`${guide.readingTimeMinutes} ${GUIDE_COPY.minRead}`}</p>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}
