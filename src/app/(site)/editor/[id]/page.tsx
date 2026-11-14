import type { Metadata } from "next";
import ClientLoader from "./ClientLoader";

// Local-only shell with no public content. robots.txt also disallows it; this tag covers a
// crawler that reaches the URL some other way.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
    return <ClientLoader params={params} />;
}
