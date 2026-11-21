import type { ReactNode } from "react";

/**
 * A piece of resume text in the preview. The preview does not edit anything: a click on it opens the
 * Go to / Customize menu (see PreviewNavMenu) and a Ctrl/Cmd+click on a link follows it. An empty field
 * renders nothing, so missing content never shows a placeholder.
 */
export function PreviewField({
    value,
    as = "div",
    className,
    staticRender,
    dataAttrs,
}: {
    value?: string;
    as?: keyof React.JSX.IntrinsicElements;
    className?: string;
    staticRender?: ReactNode;
    /** Extra attributes on the wrapper (test ids, data-nav-* click targets). */
    dataAttrs?: Record<string, string>;
}) {
    const content = staticRender ?? (value || null);
    if (content == null) return null;
    const Wrapper = as as React.ElementType;
    return <Wrapper className={className} {...dataAttrs}>{content}</Wrapper>;
}
