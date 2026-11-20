"use client";

import Link from "next/link";
import { ArrowRight, Bell, Bot, FilePlus, FolderOpen, Globe, Pencil, Upload } from "lucide-react";
import { AppEntryLink } from "@/components/ui/AppEntryLink";
import { useTranslation } from "@/lib/i18n";

const ACTIONS = [
  { key: "edit", Icon: Pencil },
  { key: "create", Icon: FilePlus },
  { key: "export", Icon: Upload },
  { key: "control", Icon: Bell },
] as const;

/** The workspace folder: the headline feature after the hero. The long version is /how-it-works. */
export function WorkspaceSection() {
  const { t } = useTranslation();

  return (
    <section id="workspace" className="border-b border-edge bg-surface-1 px-6 py-24 sm:py-32" data-testid="landing-workspace">
      <div className="mx-auto max-w-7xl">
        <p className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-accent">{t("landing.workspace.kicker")}</p>
        <h2 className="mt-5 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.045em] text-strong sm:text-5xl">{t("landing.workspace.title")}</h2>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-mid">{t("landing.workspace.subtitle")}</p>

        <div
          className="mt-10 grid gap-3 rounded-2xl border border-edge bg-surface-2 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center"
          data-testid="landing-workspace-flow"
        >
          {([
            { Icon: Globe, title: t("landing.workspace.flow.app"), text: t("landing.workspace.flow.appText") },
            { Icon: FolderOpen, title: t("landing.workspace.flow.folder"), text: t("landing.workspace.flow.folderText"), accent: true },
            { Icon: Bot, title: t("landing.workspace.flow.agent"), text: t("landing.workspace.flow.agentText") },
          ] as const).flatMap((step, index) => [
            ...(index > 0 ? [<span key={`arrow-${index}`} className="flex justify-center text-faint" aria-hidden="true"><ArrowRight className="h-5 w-5 rotate-90 lg:rotate-0" /><ArrowRight className="-ml-2 hidden h-5 w-5 rotate-180 lg:block" /></span>] : []),
            <div key={step.title} className={`rounded-xl border p-4 ${"accent" in step && step.accent ? "border-accent/40 bg-accent/5" : "border-edge bg-surface-1"}`}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-strong">
                <step.Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-mid">{step.text}</p>
            </div>,
          ])}
        </div>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="landing-workspace-actions">
          {ACTIONS.map(({ key, Icon }) => (
            <li key={key} className="rounded-xl border border-edge bg-surface-2 p-5">
              <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-strong">{t(`landing.workspace.${key}.title`)}</h3>
              <p className="mt-1.5 text-sm leading-6 text-mid">{t(`landing.workspace.${key}.text`)}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/how-it-works"
            data-testid="landing-workspace-how"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-accent px-6 text-base font-semibold text-surface-0 transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("landing.workspace.how")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <AppEntryLink href="/dashboard" className="inline-flex min-h-12 items-center justify-center rounded-lg px-3 text-base font-medium text-mid underline decoration-edge-strong underline-offset-4 transition-colors hover:text-strong">
            {t("landing.workspace.connect")}
          </AppEntryLink>
        </div>
        <p className="mt-4 text-sm text-dim">{t("landing.workspace.note")}</p>
      </div>
    </section>
  );
}
