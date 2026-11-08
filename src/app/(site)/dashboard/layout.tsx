import type { Metadata } from "next";
import type { ReactNode } from "react";

// The dashboard lists resumes from local storage, so crawlers only see an
// empty shell. Keep it out of the index; robots.txt must not block it or
// Google never reads this tag.
export const metadata: Metadata = {
    title: "Dashboard | EngineCV",
    description:
        "Your saved resumes and templates, stored only in this browser. Open, duplicate, import or export a CV without an account.",
    robots: { index: false, follow: true },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return children;
}
