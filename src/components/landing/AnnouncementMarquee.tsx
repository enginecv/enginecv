"use client";

import { useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { Bug, Github, Mail, Sparkles, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";

interface MarqueeItem {
    icon: LucideIcon;
    label: string;
}

export function AnnouncementMarquee() {
    const { t } = useTranslation();
    const [dialogOpen, setDialogOpen] = useState(false);

    const [emblaRef] = useEmblaCarousel(
        { loop: true, dragFree: true, align: "start", containScroll: false },
        [
            AutoScroll({
                playOnInit: true,
                speed: 0.6,
                startDelay: 0,
                stopOnInteraction: false,
                stopOnMouseEnter: true,
                stopOnFocusIn: false,
            }),
        ],
    );

    const items = useMemo<MarqueeItem[]>(
        () => [
            { icon: Github, label: t("marquee.tagGithub") },
            { icon: Bug, label: t("marquee.tagFeedback") },
            { icon: Mail, label: "support@enginecv.app" },
        ],
        [t],
    );

    const repeated = useMemo<MarqueeItem[]>(
        () => Array.from({ length: 6 }, () => items).flat(),
        [items],
    );

    return (
        <div
            className="relative border-y border-edge bg-surface-1 overflow-hidden"
            role="region"
            aria-label={t("marquee.tagFeedback")}
        >
            <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-4 pr-3 bg-gradient-to-r from-surface-1 via-surface-1 to-transparent">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                    <Sparkles className="w-3 h-3" />
                    {t("marquee.newBadge")}
                </span>
            </div>

            <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex py-2 pl-24">
                    {repeated.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setDialogOpen(true)}
                                className="group flex shrink-0 items-center gap-2 px-16 text-xs text-mid hover:text-strong transition-colors cursor-pointer"
                            >
                                <Icon
                                    className="w-3.5 h-3.5 text-accent group-hover:text-accent-soft transition-colors"
                                    aria-hidden="true"
                                />
                                <span className="underline-offset-4 group-hover:underline">
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-surface-1 to-transparent pointer-events-none" />

            {dialogOpen && <FeedbackDialog onClose={() => setDialogOpen(false)} />}
        </div>
    );
}
