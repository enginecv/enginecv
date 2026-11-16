"use client";

import Link from "next/link";
import { ArrowRight, Check, FileText } from "lucide-react";
import { AgentWalkthroughDiagram } from "@/components/diagrams/AgentWalkthroughDiagram";
import { useTranslation } from "@/lib/i18n";

// Sample content, the same in every language: it is file text, not interface text.
const SAMPLE_FILE_NAME = "john-doe.enginecv.json";
const SAMPLE_BEFORE = `{
  "format": "enginecv.authoring/v1",
  "basics": { "name": "John Doe" },
  "projects": [`;
const SAMPLE_ADDED = '    { "name": "Weather Bot" }';
const SAMPLE_AFTER = `  ]
}`;

const POINT_KEYS = [
  "landing.agentFile.point1",
  "landing.agentFile.point2",
  "landing.agentFile.point3",
  "landing.agentFile.point4",
] as const;

/** The file-on-your-computer way to keep a CV, shown next to what an agent does to it. */
export function LinkedFileSection() {
  const { t } = useTranslation();

  return (
    <section id="agent-file" className="border-b border-edge px-6 py-24 sm:py-32" data-testid="landing-agent-file">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
        <div>
          <p className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-accent">
            {t("landing.agentFile.kicker")}
          </p>
          <h2 className="mt-5 text-4xl font-black leading-[0.98] tracking-[-0.045em] text-strong sm:text-5xl">
            {t("landing.agentFile.title1")}
            <span className="mt-1 block text-accent">{t("landing.agentFile.title2")}</span>
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-mid">{t("landing.agentFile.description")}</p>
          <ul className="mt-8 space-y-2 text-sm text-bright">
            {POINT_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-3 border-t border-edge py-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden="true" />
                {t(key)}
              </li>
            ))}
          </ul>
          <Link
            href="/linked-files"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-bright underline decoration-edge-strong underline-offset-4 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("landing.agentFile.link")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div>
          <div className="overflow-hidden rounded-[1.1rem] border border-edge-strong bg-surface-0 shadow-[0_24px_70px_rgba(0,0,0,0.22)]" aria-hidden="true">
            <div className="flex items-center gap-2 border-b border-edge px-5 py-3 text-sm font-medium text-strong">
              <FileText className="h-4 w-4 text-accent" />
              <code className="font-[family-name:var(--font-geist-mono)] text-xs text-strong">{SAMPLE_FILE_NAME}</code>
            </div>
            <pre className="overflow-x-auto px-5 py-4 font-[family-name:var(--font-geist-mono)] text-xs leading-6 text-bright">
{SAMPLE_BEFORE}
<span className="block border-l-2 border-success bg-success/10 pl-2 text-strong">{SAMPLE_ADDED}</span>
{SAMPLE_AFTER}
            </pre>
            <div className="flex items-center justify-between gap-3 border-t border-edge bg-surface-1 px-5 py-3 text-xs">
              <span className="text-faint">{t("landing.agentFile.mockLabel")}</span>
              <span className="font-semibold text-success">{t("linkedFile.updated", { added: 1, removed: 0, changed: 0 })}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-14 max-w-7xl" data-testid="landing-agent-walkthrough">
        <AgentWalkthroughDiagram />
      </div>
    </section>
  );
}
