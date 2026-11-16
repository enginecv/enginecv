"use client";

import { Bot, FileText, History, Link2, User } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";
import { Connector, DiagramFrame } from "./DiagramFrame";

// Sample data: the same in every language.
const SAMPLE_FILE_NAME = "john-doe.enginecv.json";

function Step({ number, title, text, children, testId }: { number: number; title: string; text: string; children: ReactNode; testId: string }) {
    return (
        <li className="flex min-w-0 flex-col rounded-xl border border-edge bg-surface-2 p-4" data-testid={testId}>
            <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent font-[family-name:var(--font-geist-mono)] text-xs font-semibold text-surface-2" aria-hidden="true">
                    {number}
                </span>
                <h3 className="text-sm font-semibold text-strong">{title}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-mid">{text}</p>
            <div className="mt-4 flex-1 rounded-lg border border-edge bg-surface-1 p-3" aria-hidden="true">{children}</div>
        </li>
    );
}

/** From linking a file to seeing the agent's change: three small mock screens. */
export function AgentWalkthroughDiagram() {
    const { t } = useTranslation();

    return (
        <DiagramFrame caption={t("diagram.agent.caption")} testId="diagram-agent-walkthrough">
            <ol className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
                <Step number={1} title={t("diagram.agent.step1.title")} text={t("diagram.agent.step1.text")} testId="diagram-agent-step-1">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-edge px-2.5 py-1.5 text-xs text-bright">
                        <Link2 className="h-3.5 w-3.5 text-accent" />
                        {t("linkedFile.link")}
                    </span>
                    <span className="mt-3 flex items-center gap-1.5 font-[family-name:var(--font-geist-mono)] text-[11px] text-mid">
                        <FileText className="h-3.5 w-3.5 text-accent" />
                        {SAMPLE_FILE_NAME}
                    </span>
                </Step>
                <Connector />
                <Step number={2} title={t("diagram.agent.step2.title")} text={t("diagram.agent.step2.text")} testId="diagram-agent-step-2">
                    <div className="flex items-start gap-2 text-xs text-bright">
                        <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
                        <span className="rounded-lg bg-surface-3 px-2.5 py-1.5">{t("diagram.agent.step2.you")}</span>
                    </div>
                    <div className="mt-2 flex items-start gap-2 text-xs text-bright">
                        <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                        <span className="rounded-lg border border-accent/30 bg-accent/5 px-2.5 py-1.5">{t("diagram.agent.step2.agent")}</span>
                    </div>
                </Step>
                <Connector />
                <Step number={3} title={t("diagram.agent.step3.title")} text={t("diagram.agent.step3.text")} testId="diagram-agent-step-3">
                    <p className="rounded-lg border border-success/30 bg-success/5 px-2.5 py-1.5 text-xs font-medium text-success">
                        {t("linkedFile.updated", { added: 1, removed: 0, changed: 0 })}
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-mid">
                        <History className="h-3.5 w-3.5" />
                        {t("diagram.agent.step3.history")}
                    </p>
                </Step>
            </ol>
        </DiagramFrame>
    );
}
