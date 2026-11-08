"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, type, ...props }, ref) => (
        <input
            ref={ref}
            type={type}
            className={cn(
                "flex h-11 w-full rounded-xl border border-edge bg-surface-1 py-2.5 px-4 text-sm text-strong ring-offset-surface-1 placeholder:text-faint/50 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-all duration-200 disabled:opacity-50",
                className
            )}
            {...props}
        />
    )
);
Input.displayName = "Input";

export { Input };
