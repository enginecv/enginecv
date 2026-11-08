import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { ContactContent } from "@/components/contact/ContactContent";

export const metadata: Metadata = pageMetadata({
    title: "Contact | EngineCV",
    description: "Contact EngineCV for support, feedback, partnerships, jobs, and founder notes.",
    path: "/contact",
});

export default function ContactPage() {
    return <ContactContent />;
}
