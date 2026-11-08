import * as React from "react";
import { cn } from "@/lib/utils";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode;
}

const Kbd = React.forwardRef<HTMLElement, KbdProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <kbd
                className={cn(
                    "pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-edge bg-surface-4 px-1.5 font-mono text-[10px] font-medium text-mid opacity-100",
                    className
                )}
                ref={ref}
                {...props}
            >
                {children}
            </kbd>
        );
    }
);
Kbd.displayName = "Kbd";

export { Kbd };
