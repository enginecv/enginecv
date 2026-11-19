"use client";

import { useId, type ReactNode } from "react";
import { Input } from "@/components/editor/FormUtils";

/**
 * Field primitives for the letter panes. A single-line field is the CV editor's own `Input`,
 * and the multi-line one uses the same label and control styling, so a letter's form is
 * indistinguishable from the CV's.
 */
const labelClass = "text-[11px] font-medium text-faint uppercase tracking-wider";
const controlClass = "w-full bg-surface-1 border border-edge rounded-xl py-2.5 px-4 text-sm text-strong focus:outline-none focus:border-faint transition-colors placeholder:text-faint/50 disabled:opacity-60";

export function TextField({ label, value, onChange, placeholder, type = "text", disabled, testId }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
    disabled?: boolean;
    testId?: string;
}) {
    return (
        <Input
            label={label}
            type={type}
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            data-testid={testId}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        />
    );
}

export function TextAreaField({ label, value, onChange, placeholder, rows = 3, disabled, testId }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    testId?: string;
}) {
    const id = useId();
    return (
        <div className="space-y-2">
            <label htmlFor={id} className={labelClass}>{label}</label>
            <textarea id={id} rows={rows} value={value} disabled={disabled} placeholder={placeholder} data-testid={testId} onChange={(event) => onChange(event.target.value)} className={`${controlClass} resize-y`} />
        </div>
    );
}

export function SelectField({ label, value, onChange, disabled, testId, id, children, hint }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    testId?: string;
    id: string;
    children: ReactNode;
    hint?: ReactNode;
}) {
    return (
        <div className="space-y-2">
            <label htmlFor={id} className={labelClass}>{label}</label>
            <select id={id} value={value} disabled={disabled} data-testid={testId} onChange={(event) => onChange(event.target.value)} className={controlClass}>
                {children}
            </select>
            {hint}
        </div>
    );
}

/** A headed block of a letter form, in the same heading style as the CV editor's forms (no nested card). */
export function PaneSection({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
    return (
        <section className="space-y-4" data-testid={testId}>
            <h3 className="text-sm font-medium text-strong/90">{title}</h3>
            {children}
        </section>
    );
}
