"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import { createResumeFromExample } from "@/lib/onboarding/create-example";
import { EXAMPLE_ROLES, type ExampleRoleId } from "@/lib/onboarding/examples";

/** "Start from an example": pick a role, get a filled-in resume to overwrite. */
export default function ExamplePickerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t, locale } = useTranslation();
    const router = useRouter();
    const titleId = useId();
    const introId = useId();
    const [pendingRole, setPendingRole] = useState<ExampleRoleId | null>(null);
    const [error, setError] = useState<string | null>(null);
    const close = () => {
        if (pendingRole) return;
        setError(null);
        onClose();
    };
    const dialogRef = useDialogFocus<HTMLDivElement>(open, close);

    if (!open) return null;

    const pick = async (roleId: ExampleRoleId, titleKey: string) => {
        setPendingRole(roleId);
        setError(null);
        try {
            const id = await createResumeFromExample(roleId, locale, t("onboarding.example.resumeTitle", { role: t(titleKey) }));
            router.push(`/editor/${id}`);
        } catch (cause) {
            console.error("[EngineCV] Creating an example resume failed.", cause);
            setError(t("onboarding.example.error"));
            setPendingRole(null);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) close();
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={introId}
                data-testid="example-picker-dialog"
                className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[1rem] border border-edge bg-surface-4 p-6 shadow-2xl sm:p-8"
            >
                <button type="button" onClick={close} aria-label={t("common.close")} className="absolute top-4 right-4 text-faint transition-colors hover:text-strong">
                    <X className="h-5 w-5" aria-hidden="true" />
                </button>

                <h2 id={titleId} className="mb-2 text-xl font-semibold text-strong">{t("onboarding.example.dialogTitle")}</h2>
                <p id={introId} className="mb-6 text-sm text-faint">{t("onboarding.example.dialogIntro")}</p>

                <ul className="space-y-3">
                    {EXAMPLE_ROLES.map((role) => (
                        <li key={role.id}>
                            <button
                                type="button"
                                onClick={() => void pick(role.id, role.titleKey)}
                                disabled={pendingRole !== null}
                                aria-busy={pendingRole === role.id || undefined}
                                data-testid={`example-role-${role.id}`}
                                className="flex w-full items-start gap-3 rounded-xl border border-edge bg-surface-1 p-4 text-left transition-all hover:border-faint hover:bg-edge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium text-strong">{t(role.titleKey)}</span>
                                    <span className="block text-xs text-faint">{t(role.hintKey)}</span>
                                </span>
                                {pendingRole === role.id && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-faint" aria-hidden="true" />}
                            </button>
                        </li>
                    ))}
                </ul>

                {error && <p role="alert" className="mt-4 text-sm text-danger-soft">{error}</p>}
            </div>
        </div>
    );
}
