import type { Metadata } from "next";
import { ChangelogContent } from "@/components/changelog/ChangelogContent";
import { Footer } from "@/components/landing/Footer";
import { Navbar } from "@/components/landing/Navbar";
import { loadChangelog } from "@/lib/changelog/load";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = pageMetadata({
    title: "Changelog | EngineCV",
    description: "Every user-facing change to EngineCV — new features, improvements and fixes, straight from the repository.",
    path: "/changelog",
});

export default function ChangelogPage() {
    const changelog = loadChangelog();

    return (
        <div className="min-h-screen bg-surface-2 text-strong">
            <Navbar />
            <ChangelogContent
                changelog={changelog}
                showUnreleased={process.env.NODE_ENV !== "production"}
            />
            <Footer />
        </div>
    );
}
