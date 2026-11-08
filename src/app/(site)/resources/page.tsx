import type { Metadata } from "next";
import { ResourcesPage } from "@/components/resources/ResourcesPage";
import { resourcesMetadata } from "@/lib/resources-metadata";

export const metadata: Metadata = resourcesMetadata("en");

export default function ResourcesIndexPage() {
    return <ResourcesPage locale="en" />;
}
