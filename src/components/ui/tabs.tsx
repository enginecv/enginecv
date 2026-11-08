"use client";

import * as React from "react";

type TabsContextValue = {
    value: string;
    setValue: (value: string) => void;
    baseId: string;
    orientation: "horizontal" | "vertical";
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function cx(...classes: Array<string | undefined | false | null>) {
    return classes.filter(Boolean).join(" ");
}

function useTabs() {
    const context = React.useContext(TabsContext);

    if (!context) {
        throw new Error("useTabs must be used within a <Tabs />");
    }

    return context;
}

function getTriggerId(baseId: string, value: string) {
    return `${baseId}-trigger-${value}`;
}

function getContentId(baseId: string, value: string) {
    return `${baseId}-content-${value}`;
}

const Tabs = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        value?: string;
        defaultValue?: string;
        onValueChange?: (value: string) => void;
        orientation?: "horizontal" | "vertical";
    }
>(({ value: valueProp, defaultValue, onValueChange, orientation = "horizontal", className, ...props }, ref) => {
    const baseId = React.useId();
    const [_value, _setValue] = React.useState(defaultValue ?? "");
    const value = valueProp ?? _value;

    const setValue = React.useCallback((nextValue: string) => {
        if (onValueChange) {
            onValueChange(nextValue);
            return;
        }
        _setValue(nextValue);
    }, [onValueChange]);

    return (
        <TabsContext.Provider value={{ value, setValue, baseId, orientation }}>
            <div ref={ref} className={className} {...props} />
        </TabsContext.Provider>
    );
});
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        variant?: "default" | "line";
    }
>(({ className, variant = "default", ...props }, ref) => {
    const { orientation } = useTabs();

    return (
        <div
            ref={ref}
            role="tablist"
            aria-orientation={orientation}
            className={cx(
                "inline-flex rounded-xl border border-edge bg-surface-4 p-1",
                orientation === "vertical" ? "flex-col" : "items-center",
                variant === "line" && "border-x-0 border-t-0 bg-transparent p-0",
                className,
            )}
            {...props}
        />
    );
});
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        value: string;
    }
>(({ value, className, disabled, onClick, onKeyDown, ...props }, ref) => {
    const { value: activeValue, setValue, baseId, orientation } = useTabs();
    const isActive = activeValue === value;

    const moveFocus = (event: React.KeyboardEvent<HTMLButtonElement>, direction: "next" | "previous" | "first" | "last") => {
        const root = event.currentTarget.closest("[data-tabs-root]");
        const triggers = Array.from(
            root?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? [],
        );
        const currentIndex = triggers.indexOf(event.currentTarget);
        if (currentIndex === -1) return;

        const nextIndex = direction === "first"
            ? 0
            : direction === "last"
                ? triggers.length - 1
                : direction === "next"
                    ? (currentIndex + 1) % triggers.length
                    : (currentIndex - 1 + triggers.length) % triggers.length;

        const nextTrigger = triggers[nextIndex];
        nextTrigger?.focus();
        nextTrigger?.click();
    };

    return (
        <button
            ref={ref}
            type="button"
            role="tab"
            id={getTriggerId(baseId, value)}
            aria-selected={isActive}
            aria-controls={getContentId(baseId, value)}
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            data-state={isActive ? "active" : "inactive"}
            className={cx(
                "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-mid transition-colors hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-50",
                isActive && "bg-surface-2 text-strong shadow-sm",
                className,
            )}
            onClick={(event) => {
                onClick?.(event);
                if (!event.defaultPrevented) {
                    setValue(value);
                }
            }}
            onKeyDown={(event) => {
                onKeyDown?.(event);
                if (event.defaultPrevented) return;

                const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
                const previousKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";

                if (event.key === nextKey) {
                    event.preventDefault();
                    moveFocus(event, "next");
                }
                if (event.key === previousKey) {
                    event.preventDefault();
                    moveFocus(event, "previous");
                }
                if (event.key === "Home") {
                    event.preventDefault();
                    moveFocus(event, "first");
                }
                if (event.key === "End") {
                    event.preventDefault();
                    moveFocus(event, "last");
                }
            }}
            {...props}
        />
    );
});
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        value: string;
    }
>(({ value, className, ...props }, ref) => {
    const { value: activeValue, baseId } = useTabs();
    const isActive = activeValue === value;

    return (
        <div
            ref={ref}
            role="tabpanel"
            id={getContentId(baseId, value)}
            aria-labelledby={getTriggerId(baseId, value)}
            data-state={isActive ? "active" : "inactive"}
            hidden={!isActive}
            className={cx("focus-visible:outline-none", className)}
            {...props}
        />
    );
});
TabsContent.displayName = "TabsContent";

export {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
};
