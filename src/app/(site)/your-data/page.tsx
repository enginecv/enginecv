import type { Metadata } from "next";
import { Suspense } from "react";
import { YourDataPage } from "@/components/your-data/YourDataPage";
import { pageMetadata } from "@/lib/site";

// A tool, not an article: it lists what is in the visitor's own browser, so a
// crawler sees an empty shell. Keep it out of the index, but followable and
// reachable from /privacy and the footer.
export const metadata: Metadata = {
    ...pageMetadata({
        title: "Your data | EngineCV",
        description: "Everything EngineCV keeps in this browser, a copy to download, and a button that deletes all of it.",
        path: "/your-data",
    }),
    robots: { index: false, follow: true },
};

export default function Page() {
    return (
        <Suspense>
            <YourDataPage />
        </Suspense>
    );
}
