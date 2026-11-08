import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { SupportersContent } from "@/components/support/SupportersContent";

export const metadata: Metadata = pageMetadata({
    title: "Supporters | EngineCV",
    description: "The people who support EngineCV on Ko-fi and help keep the resume builder free for everyone.",
    path: "/supporters",
});

export default function SupportersPage() {
    return <SupportersContent />;
}
