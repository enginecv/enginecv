import type { ReactNode } from "react";

export default function SnapshotLayout({ children }: { children: ReactNode }) {
    return (
        <div style={{ background: "#ffffff", width: "100%", minHeight: "100vh" }}>
            <style>{`
                nextjs-portal,
                #__next-build-watcher,
                [data-nextjs-toast],
                [data-nextjs-dialog-overlay],
                [data-next-mark] {
                    display: none !important;
                }
            `}</style>
            {children}
        </div>
    );
}
