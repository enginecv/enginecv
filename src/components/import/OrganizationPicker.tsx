"use client";

import { Building2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { type NormalizedOrganization } from "@/lib/import/provider";

interface OrganizationPickerProps {
    organizations: NormalizedOrganization[];
    selectedLogins: Set<string>;
    onToggle: (login: string) => void;
}

function compareOrganizations(a: NormalizedOrganization, b: NormalizedOrganization): number {
    return a.login.localeCompare(b.login);
}

export function getDefaultSelectedOrganizationLogins(organizations: NormalizedOrganization[]): Set<string> {
    return new Set(organizations.map((organization) => organization.login));
}

export function OrganizationPicker({
    organizations,
    selectedLogins,
    onToggle,
}: OrganizationPickerProps) {
    const { t } = useTranslation();
    const orderedOrganizations = useMemo(
        () => [...organizations].sort(compareOrganizations),
        [organizations],
    );

    return (
        <div className="space-y-3" data-testid="github-import-organization-picker">
            {orderedOrganizations.length === 0 ? (
                <div
                    data-testid="github-import-empty-organizations"
                    className="rounded-xl border border-edge bg-surface-1 p-3 text-xs leading-5 text-dim"
                >
                    {t("githubImport.emptyOrganizations")}
                </div>
            ) : (
                <div className="space-y-2">
                    {orderedOrganizations.map((organization) => {
                        const checked = selectedLogins.has(organization.login);
                        const displayName = organization.name || organization.login;

                        return (
                            <label
                                key={organization.login}
                                data-testid="github-import-organization-row"
                                className="flex cursor-pointer items-start gap-3 rounded-xl border border-edge bg-surface-1 p-3 transition-colors hover:border-faint"
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => onToggle(organization.login)}
                                    className="mt-1 h-4 w-4 accent-accent"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="flex min-w-0 items-center gap-2">
                                        <Building2 className="h-4 w-4 shrink-0 text-faint" />
                                        <span className="break-words text-sm font-medium text-strong">
                                            {displayName}
                                        </span>
                                    </span>
                                    {organization.description && (
                                        <span className="mt-1 block line-clamp-2 break-words text-xs leading-5 text-dim">
                                            {organization.description}
                                        </span>
                                    )}
                                    <span className="mt-2 block break-words text-xs text-faint">
                                        {organization.url || `github.com/${organization.login}`}
                                    </span>
                                </span>
                            </label>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
