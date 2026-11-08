"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import { useKeepRouteLocale } from "@/lib/i18n/keep-route-locale";
import { createResumeFromContent } from "@/lib/onboarding/create-example";
import { getRoleExample } from "@/lib/role-examples/registry";

/**
 * Copies an example CV into the visitor's browser as a new resume and opens it
 * in the editor. Every press makes a new copy; nothing existing is touched.
 * `locale` is the page language, which chooses the language of the CV text.
 */
export function EditExampleButton({ roleId, locale, name }: { roleId: string; locale: Locale; name: string }) {
    const { t, locale: uiLocale } = useTranslation();
    const router = useRouter();
    const keepRouteLocale = useKeepRouteLocale();
    const pendingRef = useRef(false);
    const [pending, setPending] = useState(false);
    const [failed, setFailed] = useState(false);

    // Fetch the example's content once the page is idle, so the copy still works if the network drops afterwards.
    useEffect(() => {
        void getRoleExample(roleId)?.loadContent().catch(() => undefined);
    }, [roleId]);

    const create = async () => {
        if (pendingRef.current) return;
        pendingRef.current = true;
        setPending(true);
        setFailed(false);

        try {
            const role = getRoleExample(roleId);
            if (!role) throw new Error(`Unknown role example "${roleId}".`);
            const content = await role.loadContent();
            const id = await createResumeFromContent(content, uiLocale, t("onboarding.example.resumeTitle", { role: name }), locale);
            keepRouteLocale();
            router.push(`/editor/${id}`);
        } catch (cause) {
            console.error("[EngineCV] Creating a resume from a role example failed.", cause);
            setFailed(true);
            pendingRef.current = false;
            setPending(false);
        }
        // On success the page navigates away; the button stays disabled until it does.
    };

    return (
        <div>
            <button
                type="button"
                data-testid="edit-example"
                disabled={pending}
                onClick={() => void create()}
                className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-surface-2 transition-colors hover:bg-accent-soft disabled:cursor-wait disabled:opacity-80"
            >
                {pending ? t("roleExamples.editPending") : t("roleExamples.editAction")}
            </button>
            {failed ? (
                <p role="alert" data-testid="edit-example-error" className="mt-3 text-sm text-danger-soft">
                    {t("roleExamples.copyError")}
                </p>
            ) : null}
        </div>
    );
}
