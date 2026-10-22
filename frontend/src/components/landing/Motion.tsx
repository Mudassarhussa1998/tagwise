"use client";

import { useEffect, useRef } from "react";

function onceVisible(el: Element, run: () => void, threshold = 0.15) {
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        run();
        io.disconnect();
      }
    },
    { threshold, rootMargin: "0px 0px -40px 0px" },
  );
  io.observe(el);
  return () => io.disconnect();
}

/** Fades and slides its children in the first time they scroll into view (styles in globals.css). */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return onceVisible(el, () => (el.dataset.visible = ""));
  }, []);
  return (
    <div ref={ref} data-reveal className={className} style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  );
}

/** Counts up from 0 to `to` when scrolled into view. Writes the DOM directly, so no re-renders. */
export function CountUp({ to, suffix = "", duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.textContent = `0${suffix}`;
    let frame = 0;
    const cancel = onceVisible(el, () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        el.textContent = `${Math.round(to * (1 - Math.pow(1 - t, 3)))}${suffix}`;
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, 0.6);
    return () => {
      cancel();
      cancelAnimationFrame(frame);
    };
  }, [to, suffix, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {to}
      {suffix}
    </span>
  );
}

/** Sticky header that gains a border and shadow once the page is scrolled. */
export function ScrollHeader({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => (el.dataset.scrolled = window.scrollY > 8 ? "true" : "false");
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <header
      ref={ref}
      data-scrolled="false"
      className="sticky top-0 z-40 border-b border-transparent bg-white/70 backdrop-blur-lg transition-[border-color,box-shadow,background-color] duration-300 data-[scrolled=true]:border-slate-200/80 data-[scrolled=true]:bg-white/90 data-[scrolled=true]:shadow-[0_4px_20px_-8px_rgba(15,23,42,0.12)]"
    >
      <div className="scroll-progress absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary-600 to-sky-400" />
      {children}
    </header>
  );
}
