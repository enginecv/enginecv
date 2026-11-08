"use client";

import { useTranslation } from "@/lib/i18n";

import * as React from "react";
import { PanelLeft } from "lucide-react";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "4.5rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const MOBILE_QUERY = "(max-width: 767px)";

type SidebarContextValue = {
    open: boolean;
    setOpen: (open: boolean) => void;
    openMobile: boolean;
    setOpenMobile: (open: boolean) => void;
    isMobile: boolean;
    toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function cx(...classes: Array<string | undefined | false | null>) {
    return classes.filter(Boolean).join(" ");
}

function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        const media = window.matchMedia(MOBILE_QUERY);
        const onChange = () => setIsMobile(media.matches);

        onChange();
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);

    return isMobile;
}

function useSidebar() {
    const context = React.useContext(SidebarContext);

    if (!context) {
        throw new Error("useSidebar must be used within a <SidebarProvider />");
    }

    return context;
}

const SidebarProvider = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        defaultOpen?: boolean;
        open?: boolean;
        onOpenChange?: (open: boolean) => void;
    }
>(({ defaultOpen = true, open: openProp, onOpenChange, className, style, children, ...props }, ref) => {
    const isMobile = useIsMobile();
    const [_open, _setOpen] = React.useState(defaultOpen);
    const [openMobile, setOpenMobile] = React.useState(false);
    const open = openProp ?? _open;

    const setOpen = React.useCallback((value: boolean) => {
        if (onOpenChange) {
            onOpenChange(value);
            return;
        }
        _setOpen(value);
    }, [onOpenChange]);

    const toggleSidebar = React.useCallback(() => {
        if (isMobile) {
            setOpenMobile((value) => !value);
            return;
        }
        setOpen(!open);
    }, [isMobile, open, setOpen]);

    React.useEffect(() => {
        if (!isMobile) {
            setOpenMobile(false);
        }
    }, [isMobile]);

    return (
        <SidebarContext.Provider
            value={{
                open,
                setOpen,
                openMobile,
                setOpenMobile,
                isMobile,
                toggleSidebar,
            }}
        >
            <div
                ref={ref}
                style={{
                    "--sidebar-width": SIDEBAR_WIDTH,
                    "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                    "--sidebar-width-mobile": SIDEBAR_WIDTH_MOBILE,
                    ...style,
                } as React.CSSProperties}
                className={cx("flex min-h-svh w-full", className)}
                {...props}
            >
                {children}
            </div>
        </SidebarContext.Provider>
    );
});
SidebarProvider.displayName = "SidebarProvider";

const Sidebar = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        side?: "left" | "right";
        variant?: "sidebar" | "floating" | "inset";
        collapsible?: "offcanvas" | "icon" | "none";
    }
>(({ side = "left", collapsible = "offcanvas", className, children, style, ...props }, ref) => {
    const { open, openMobile, setOpenMobile } = useSidebar();
    const { t } = useTranslation();
    const isRight = side === "right";
    const isIconCollapsed = collapsible === "icon" && !open;

    return (
        <>
            <aside
                ref={ref}
                data-state={open ? "expanded" : "collapsed"}
                data-collapsible={collapsible}
                style={{
                    width: isIconCollapsed ? "var(--sidebar-width-icon)" : "var(--sidebar-width)",
                    ...style,
                }}
                className={cx(
                    "hidden shrink-0 border-edge bg-surface-1 text-strong transition-[width] duration-200 md:sticky md:top-0 md:h-svh md:flex-col",
                    isRight ? "md:order-last md:border-l" : "md:border-r",
                    open || collapsible === "icon" ? "md:!flex" : "md:hidden",
                    className,
                )}
                {...props}
            >
                {children}
            </aside>

            {openMobile && (
                <>
                    <button
                        type="button"
                        aria-label={t("sidebar.close")}
                        className="fixed inset-0 z-[120] cursor-default bg-black/60 backdrop-blur-sm md:hidden"
                        onClick={() => setOpenMobile(false)}
                    />

                    <aside
                        style={{
                            width: "var(--sidebar-width-mobile)",
                            maxWidth: "calc(100vw - 2rem)",
                        }}
                        className={cx(
                            "fixed inset-y-0 z-[130] flex flex-col border-edge bg-surface-1 text-strong shadow-2xl shadow-black/40 md:hidden",
                            isRight ? "right-0 border-l" : "left-0 border-r",
                            className,
                        )}
                        {...props}
                    >
                        {children}
                    </aside>
                </>
            )}
        </>
    );
});
Sidebar.displayName = "Sidebar";

const SidebarInset = React.forwardRef<
    HTMLElement,
    React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
    <main
        ref={ref}
        className={cx("min-w-0 flex-1", className)}
        {...props}
    />
));
SidebarInset.displayName = "SidebarInset";

const SidebarTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, onClick, ...props }, ref) => {
    const { toggleSidebar, open, openMobile } = useSidebar();
    const { t } = useTranslation();

    return (
        <button
            ref={ref}
            type="button"
            aria-label={t("sidebar.toggle")}
            aria-expanded={open || openMobile}
            className={cx(
                "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-edge bg-surface-4 text-bright transition-colors hover:border-faint hover:text-strong",
                className,
            )}
            onClick={(event) => {
                onClick?.(event);
                if (!event.defaultPrevented) {
                    toggleSidebar();
                }
            }}
            {...props}
        >
            {children ?? <PanelLeft className="h-4 w-4" aria-hidden="true" />}
        </button>
    );
});
SidebarTrigger.displayName = "SidebarTrigger";

const SidebarHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cx("shrink-0 border-b border-edge p-3", className)}
        {...props}
    />
));
SidebarHeader.displayName = "SidebarHeader";

const SidebarContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cx("min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2", className)}
        {...props}
    />
));
SidebarContent.displayName = "SidebarContent";

const SidebarFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cx("shrink-0 border-t border-edge p-2", className)}
        {...props}
    />
));
SidebarFooter.displayName = "SidebarFooter";

const SidebarGroup = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cx("py-2", className)} {...props} />
));
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cx("px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-faint", className)}
        {...props}
    />
));
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarGroupContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cx("space-y-1", className)} {...props} />
));
SidebarGroupContent.displayName = "SidebarGroupContent";

const SidebarMenu = React.forwardRef<
    HTMLUListElement,
    React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
    <ul ref={ref} className={cx("flex flex-col gap-1", className)} {...props} />
));
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<
    HTMLLIElement,
    React.LiHTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
    <li ref={ref} className={cx("min-w-0", className)} {...props} />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

const SidebarMenuButton = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        isActive?: boolean;
    }
>(({ className, isActive, ...props }, ref) => (
    <button
        ref={ref}
        type="button"
        data-active={isActive ? "true" : "false"}
        className={cx(
            "flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-all duration-200 active:scale-[0.98]",
            isActive
                ? "border-accent/30 bg-surface-4 text-strong shadow-sm shadow-accent/5"
                : "border-transparent text-mid hover:bg-surface-4/70 hover:text-strong hover:border-edge",
            className,
        )}
        {...props}
    />
));
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarMenuBadge = React.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
    <span
        ref={ref}
        className={cx("ml-auto rounded-md bg-surface-4 px-1.5 py-0.5 text-[10px] font-semibold text-mid", className)}
        {...props}
    />
));
SidebarMenuBadge.displayName = "SidebarMenuBadge";

const SidebarRail = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();
    const { t } = useTranslation();

    return (
        <button
            ref={ref}
            type="button"
            aria-label={t("sidebar.toggle")}
            className={cx("absolute inset-y-0 right-0 hidden w-2 translate-x-1/2 md:block", className)}
            onClick={toggleSidebar}
            {...props}
        />
    );
});
SidebarRail.displayName = "SidebarRail";

export {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
    useSidebar,
};
