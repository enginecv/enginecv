import type { Metadata } from "next";
import { ToolsIndex } from "@/components/tools/ToolsIndex";
import { toolsIndexMetadata } from "@/lib/tools/tool-metadata";

export const metadata: Metadata = toolsIndexMetadata("en");

export default function ToolsIndexPage() {
    return <ToolsIndex locale="en" />;
}
