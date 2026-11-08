"use client";

import { FadeIn } from "./FadeIn";
import { getExportFormatClaimParams } from "@/lib/export-formats";
import { useTranslation } from "@/lib/i18n";

const BADGE_KEYS = [
  "landing.noLockin.badgeLocal",
  "landing.noLockin.badgeEncrypted",
  "landing.noLockin.badgeNoAccounts",
  "landing.noLockin.badgeOpenFormat",
];

const EXAMPLE_JSON = `{
  "basics": {
    "name": "John Doe",
    "headline": "Senior Software Engineer",
    "email": "john@example.com",
    "phone": "+1 555-0100",
    "location": "San Francisco, CA",
    "summary": "Experienced engineer with 8+ years..."
  },
  "experience": [
    {
      "company": "Acme Corp",
      "position": "Lead Engineer",
      "startDate": "2021-03",
      "summary": "Led a team of 12 engineers..."
    }
  ],
  "education": [
    {
      "institution": "MIT",
      "degree": "B.S. Computer Science",
      "startDate": "2012-09",
      "endDate": "2016-05"
    }
  ],
  "skills": ["React", "TypeScript", "Node.js"],
  "settings": {
    "theme": "modern",
    "typography": { "fontFamily": "Inter" },
    "colors": { "accent": "#ffaa8d" }
  }
}`;

function SyntaxHighlight({ code }: { code: string }) {
  const lines = code.split("\n");

  return (
    <>
      {lines.map((line, i) => {
        const parts: React.ReactNode[] = [];
        let remaining = line;
        let key = 0;

        while (remaining.length > 0) {
          // Match a JSON key like "name":
          const keyMatch = remaining.match(/^(\s*)"([^"]+)"(\s*:\s*)/);
          if (keyMatch) {
            parts.push(<span key={key++}>{keyMatch[1]}</span>);
            parts.push(
              <span key={key++} className="text-accent">
                &quot;{keyMatch[2]}&quot;
              </span>
            );
            parts.push(<span key={key++} className="text-faint">{keyMatch[3]}</span>);
            remaining = remaining.slice(keyMatch[0].length);
            continue;
          }

          // Match a string value like "John Doe"
          const strMatch = remaining.match(/^"([^"]*)"/);
          if (strMatch) {
            parts.push(
              <span key={key++} className="text-success">
                &quot;{strMatch[1]}&quot;
              </span>
            );
            remaining = remaining.slice(strMatch[0].length);
            continue;
          }

          // Match a number
          const numMatch = remaining.match(/^(\d+)/);
          if (numMatch) {
            parts.push(
              <span key={key++} className="text-info-violet">
                {numMatch[1]}
              </span>
            );
            remaining = remaining.slice(numMatch[0].length);
            continue;
          }

          // Anything else (brackets, commas, etc.)
          parts.push(
            <span key={key++} className="text-faint">
              {remaining[0]}
            </span>
          );
          remaining = remaining.slice(1);
        }

        return (
          <div key={i} className="leading-[1.65]">
            {parts.length > 0 ? parts : "\u00A0"}
          </div>
        );
      })}
    </>
  );
}

export function NoLockInSection() {
  const { t } = useTranslation();
  const formatParams = getExportFormatClaimParams(t);

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-strong text-center mb-4">
            {t("landing.noLockin.title")}
          </h2>
          <p className="text-faint text-center text-lg mb-16 max-w-2xl mx-auto">
            {t("landing.noLockin.subtitle")}
          </p>
        </FadeIn>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* JSON Preview */}
          <FadeIn delay={100}>
            <div className="bg-surface-1 border border-edge rounded-[1.25rem] overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-edge">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-xs text-faint ml-2 font-mono">
                  resume-john-doe.json
                </span>
              </div>
              {/* Code */}
              <pre className="p-5 text-[12px] sm:text-[13px] font-[family-name:var(--font-geist-mono)] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <code>
                  <SyntaxHighlight code={EXAMPLE_JSON} />
                </code>
              </pre>
            </div>
          </FadeIn>

          {/* Text + Badges */}
          <FadeIn delay={200}>
            <div className="space-y-8 lg:py-6">
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 mt-0.5">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-strong mb-1">{t("landing.noLockin.humanReadable")}</h3>
                    <p className="text-faint text-sm leading-relaxed">
                      {t("landing.noLockin.humanReadableDesc")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 mt-0.5">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-strong mb-1">{t("landing.noLockin.exportAnytime")}</h3>
                    <p className="text-faint text-sm leading-relaxed">
                      {t("landing.noLockin.exportAnytimeDesc", formatParams)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 mt-0.5">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-strong mb-1">{t("landing.noLockin.importBack")}</h3>
                    <p className="text-faint text-sm leading-relaxed">
                      {t("landing.noLockin.importBackDesc")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {BADGE_KEYS.map((badge) => (
                  <div
                    key={badge}
                    className="flex items-center gap-2 px-4 py-2 bg-surface-1 border border-edge rounded-full text-sm text-strong/80"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-success"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {t(badge)}
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
