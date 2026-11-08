import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { landingMetadata } from "@/lib/landing-metadata";

export const metadata: Metadata = landingMetadata("en");

export default function EnglishLandingPage() {
  return <LandingPage locale="en" />;
}
