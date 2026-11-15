import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { ContactContent } from "@/components/contact/ContactContent";

export const metadata: Metadata = pageMetadata({
    title: "Contact EngineCV: Support, Feedback and Partnerships",
    description: "Contact the EngineCV team for support, bug reports, feedback, partnerships and jobs. Reach the person who builds the free resume builder.",
    path: "/contact",
});

export default function ContactPage() {
    return <ContactContent />;
}
