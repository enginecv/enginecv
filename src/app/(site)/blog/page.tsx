import type { Metadata } from "next";
import { BlogIndexPage, blogIndexMetadata } from "@/components/blog/BlogIndexPage";

export function generateMetadata(): Promise<Metadata> {
    return blogIndexMetadata("en");
}

export default function EnglishBlogIndexPage() {
    return <BlogIndexPage locale="en" />;
}
