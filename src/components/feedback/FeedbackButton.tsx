"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Bug } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
const FeedbackDialog = dynamic(() => import("./FeedbackDialog").then(module => module.FeedbackDialog), { ssr: false });

type Variant = "icon" | "link" | "compact";

interface Props {
    variant?: Variant;
    className?: string;
}

export function FeedbackButton({ variant = "icon", className = "" }: Props) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const renderTrigger = () => {
        const label = t("feedback.button");

        if (variant === "link") {
            return (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className={`inline-flex items-center gap-1.5 text-sm text-mid transition-colors hover:text-strong ${className}`}
                >
                    <Bug className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{label}</span>
                </button>
            );
        }

        if (variant === "compact") {
            return (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label={label}
                    title={label}
                    className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-faint hover:text-strong hover:bg-edge transition-colors ${className}`}
                >
                    <Bug className="w-4 h-4" />
                </button>
            );
        }

        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-faint hover:text-strong hover:bg-edge transition-colors ${className}`}
            >
                <Bug className="w-4 h-4" />
                <span>{label}</span>
            </button>
        );
    };

    return (
        <>
            {renderTrigger()}
            {open && <FeedbackDialog onClose={() => setOpen(false)} />}
        </>
    );
}
