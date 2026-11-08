"use client";

import { useRef, useState, useEffect, ReactNode } from "react";

function shouldShowImmediately() {
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;

  return prefersReducedMotion || coarsePointer || typeof window.IntersectionObserver === "undefined";
}

export function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Start hidden on both server and client so SSR HTML matches hydration;
  // the effect below reveals immediately when animation isn't wanted.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    if (shouldShowImmediately()) {
      // Reveal on the next frame rather than synchronously in the effect body,
      // so the reveal doesn't cascade a render during commit.
      const raf = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(raf);
    }
    const el = ref.current;
    if (!el) return;

    const failOpenTimer = window.setTimeout(() => {
      setVisible(true);
    }, Math.max(1200, delay + 1200));

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          window.clearTimeout(failOpenTimer);
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.05,
        rootMargin: "0px 0px -8% 0px",
      }
    );
    observer.observe(el);
    return () => {
      window.clearTimeout(failOpenTimer);
      observer.disconnect();
    };
  }, [delay, visible]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
