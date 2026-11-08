"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

import { cn } from "@/lib/utils";

const ToggleGroup = React.forwardRef<
    React.ElementRef<typeof ToggleGroupPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, children, ...props }, ref) => (
    <ToggleGroupPrimitive.Root
        ref={ref}
        className={cn(
            "inline-flex items-center gap-0.5 rounded-md border border-surface-5 bg-surface-3 p-0.5",
            className
        )}
        {...props}
    >
        {children}
    </ToggleGroupPrimitive.Root>
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
    React.ElementRef<typeof ToggleGroupPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => (
    <ToggleGroupPrimitive.Item
        ref={ref}
        className={cn(
            "inline-flex items-center justify-center rounded-sm px-2.5 py-1 text-xs font-medium text-dim hover:text-strong hover:bg-surface-4 data-[state=on]:bg-edge data-[state=on]:text-strong focus:outline-none focus-visible:ring-1 focus-visible:ring-faint transition-colors disabled:opacity-50",
            className
        )}
        {...props}
    >
        {children}
    </ToggleGroupPrimitive.Item>
));
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
