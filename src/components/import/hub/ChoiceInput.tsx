import { Check } from "lucide-react";
import type { InputHTMLAttributes } from "react";

type ChoiceInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
    type: "checkbox" | "radio";
    /** "danger" for a choice that throws something away. */
    tone?: "accent" | "danger";
};

/**
 * A native checkbox or radio drawn in the app's colours. The input stays real
 * (focus, keyboard, labels and roles are the browser's); only its look changes.
 */
export function ChoiceInput({ type, tone = "accent", ...props }: ChoiceInputProps) {
    const shape = type === "radio" ? "rounded-full" : "rounded-[5px]";
    const checked = tone === "danger" ? "checked:border-danger checked:bg-danger" : "checked:border-accent checked:bg-accent";
    return (
        <span className="relative inline-flex h-[18px] w-[18px] shrink-0">
            <input
                type={type}
                {...props}
                className={`peer h-[18px] w-[18px] cursor-pointer appearance-none border border-edge-strong bg-surface-1 outline-none transition-colors ${checked} focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2 disabled:cursor-not-allowed disabled:opacity-50 ${shape}`}
            />
            {type === "checkbox" ? (
                <Check
                    className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-surface-2 opacity-0 transition-opacity peer-checked:opacity-100"
                    strokeWidth={3.5}
                    aria-hidden="true"
                />
            ) : (
                <span
                    className="pointer-events-none absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-surface-2 opacity-0 transition-opacity peer-checked:opacity-100"
                    aria-hidden="true"
                />
            )}
        </span>
    );
}
