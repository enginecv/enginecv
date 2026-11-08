import { RootDocument, rootMetadata, rootViewport } from "@/components/app-shell/RootDocument";

export const metadata = rootMetadata;
export const viewport = rootViewport;

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument lang="en">{children}</RootDocument>;
}
