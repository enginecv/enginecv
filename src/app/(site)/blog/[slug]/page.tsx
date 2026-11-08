import type { Metadata } from "next";
import { BlogPostPage, blogPostMetadata } from "@/components/blog/BlogPostPage";
import { getBlogPosts } from "@/lib/blog";

export async function generateStaticParams() {
    return (await getBlogPosts("en")).map(({ slug }) => ({ slug }));
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { slug } = await params;
    return blogPostMetadata("en", slug);
}

export default async function EnglishBlogPostPage({ params }: { params: Params }) {
    const { slug } = await params;
    return <BlogPostPage locale="en" slug={slug} />;
}
