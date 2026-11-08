import type { Metadata } from "next";
import { RoleExamplesIndexPage, roleExamplesIndexMetadata } from "@/components/role-examples/RoleExamplesIndexPage";

export const metadata: Metadata = roleExamplesIndexMetadata("en");

export default function EnglishRoleExamplesIndexPage() {
    return <RoleExamplesIndexPage locale="en" />;
}
