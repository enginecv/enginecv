import type { ReactNode } from "react";

export default function BlogRouteLayout({ children }: { children: ReactNode }) {
    return <div className="dark">{children}</div>;
}
