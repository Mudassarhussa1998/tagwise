"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, Check, ChevronsDown, ClipboardCheck, Printer, ScanLine, Sticker } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * Scroll-driven illustrated story ("scrubbed by scroll", like a video):
 *   1. a worker photographs the machine
 *   2. prints its QR labels
 *   3. sticks a label on the machine
 *   4. an operator scans it and the check opens on their phone
 * The section is tall; the stage stays pinned while scroll progress (0..1) drives every element.
 * It opens the landing page, so it also carries the headline and main call to action.
 */

const STEPS = [
  { icon: Camera, title: "Photograph the machine", text: "Register the asset and add photos, so everyone knows exactly which machine it is." },
  { icon: Printer, title: "Print its QR labels", text: "Two labels per asset: one to run checks, one for the full report. Actual size, with cut lines." },
  { icon: Sticker, title: "Stick it on the machine", text: "Peel and place the label where operators will see it every shift." },
  { icon: ScanLine, title: "Anyone can scan it", text: "Operators point their phone camera at the label. The checklist opens instantly, with no app to install." },
];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** 0 → 1 as p goes from a to b. */
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Fade in over [a,b], hold, fade out over [c,d]. */
const window4 = (p: number, a: number, b: number, c: number, d: number) => Math.min(seg(p, a, b), 1 - seg(p, c, d));

function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      setP(total > 0 ? clamp(-rect.top / total) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return [ref, p] as const;
}

/* ---------------------------------- SVG parts ---------------------------------- */

const FLOOR = 430;

/** Tiny QR-looking glyph (finder squares + fixed dot pattern). */
function QrGlyph({ x, y, s }: { x: number; y: number; s: number }) {
  const u = s / 7;
  const dots = [
    [3, 0], [4, 1], [3, 2], [5, 3], [3, 4], [6, 4], [4, 5], [6, 6], [2, 3], [0, 3], [4, 3], [5, 5],
  ];
  const finder = (fx: number, fy: number) => (
    <g key={`${fx}-${fy}`}>
      <rect x={x + fx * u} y={y + fy * u} width={u * 3} height={u * 3} fill="#0f172a" rx={u * 0.4} />
      <rect x={x + (fx + 0.6) * u} y={y + (fy + 0.6) * u} width={u * 1.8} height={u * 1.8} fill="#fff" rx={u * 0.2} />
      <rect x={x + (fx + 1) * u} y={y + (fy + 1) * u} width={u} height={u} fill="#0f172a" />
    </g>
  );
  return (
    <g>
      {finder(0, 0)}
      {finder(4, 0)}
      {finder(0, 4)}
      {dots.map(([dx, dy]) => (
        <rect key={`${dx}${dy}`} x={x + dx * u} y={y + dy * u} width={u} height={u} fill="#0f172a" />
      ))}
    </g>
  );
}

/** QR sticker: blue header band + code, like the printed labels. */
function Label({ x, y, w = 56, scale = 1, glow = 0 }: { x: number; y: number; w?: number; scale?: number; glow?: number }) {
  const h = w * 1.25;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {glow > 0 && <rect x={-w / 2 - 8} y={-h / 2 - 8} width={w + 16} height={h + 16} rx={10} fill="none" stroke="#22c55e" strokeWidth={4} opacity={glow} />}
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={5} fill="#fff" stroke="#cbd5e1" strokeWidth={1.5} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h * 0.2} rx={5} fill="#2563eb" />
      <rect x={-w / 2} y={-h / 2 + h * 0.12} width={w} height={h * 0.08} fill="#2563eb" />
      <QrGlyph x={-w * 0.32} y={-h / 2 + h * 0.27} s={w * 0.64} />
      <rect x={-w * 0.3} y={h / 2 - h * 0.13} width={w * 0.6} height={h * 0.06} rx={2} fill="#0f172a" opacity={0.75} />
    </g>
  );
}

/** Stylised worker. `arm` = front arm angle in radians (0 down, ~2 raised forward). Children render at the hand. */
function Person({
  x,
  vest,
  hat,
  arm,
  flip = false,
  walk = 0,
  opacity = 1,
  children,
}: {
  x: number;
  vest: string;
  hat: string;
  arm: number;
  flip?: boolean;
  walk?: number;
  opacity?: number;
  children?: React.ReactNode;
}) {
  const swing = Math.sin(walk) * 16;
  const hand = { x: 12 + 52 * Math.sin(arm), y: 300 + 52 * Math.cos(arm) };
  return (
    <g transform={`translate(${x} 0) scale(${flip ? -1 : 1} 1)`} opacity={opacity}>
      <ellipse cx={0} cy={FLOOR + 2} rx={30} ry={5} fill="#0f172a" opacity={0.08} />
      {/* legs */}
      <line x1={-7} y1={362} x2={-7 + swing} y2={FLOOR - 2} stroke="#1e293b" strokeWidth={13} strokeLinecap="round" />
      <line x1={7} y1={362} x2={7 - swing} y2={FLOOR - 2} stroke="#334155" strokeWidth={13} strokeLinecap="round" />
      {/* back arm */}
      <line x1={-13} y1={302} x2={-17 - swing * 0.4} y2={350} stroke={vest} strokeWidth={11} strokeLinecap="round" opacity={0.85} />
      {/* body with reflective stripes */}
      <rect x={-21} y={290} width={42} height={76} rx={13} fill={vest} />
      <rect x={-21} y={318} width={42} height={6} fill="#fef08a" />
      <rect x={-21} y={340} width={42} height={6} fill="#fef08a" />
      {/* head + hard hat */}
      <circle cx={2} cy={270} r={17} fill="#c68a5e" />
      <path d="M-17 266 a19 19 0 0 1 38 0 z" fill={hat} />
      <rect x={-19} y={263} width={44} height={5} rx={2.5} fill={hat} />
      {/* front arm */}
      <line x1={12} y1={300} x2={hand.x} y2={hand.y} stroke={vest} strokeWidth={11} strokeLinecap="round" />
      <circle cx={hand.x} cy={hand.y} r={6} fill="#c68a5e" />
      <g transform={`translate(${hand.x} ${hand.y})`}>{children}</g>
    </g>
  );
}

function PhoneGlyph({ screen = "#1e293b" }: { screen?: string }) {
  return (
    <g transform="translate(-6 -22)">
      <rect width={14} height={24} rx={3} fill="#0f172a" />
      <rect x={2} y={3} width={10} height={17} rx={1.5} fill={screen} />
    </g>
  );
}

function Excavator({ shake = 0 }: { shake?: number }) {
  return (
    <g transform={`translate(${shake} 0)`}>
      {/* tracks */}
      <rect x={540} y={392} width={256} height={40} rx={20} fill="#334155" />
      {[566, 616, 666, 716, 766].map((cx) => (
        <circle key={cx} cx={cx} cy={412} r={12} fill="#64748b" stroke="#475569" strokeWidth={3} />
      ))}
      {/* body, cab, counterweight */}
      <rect x={560} y={312} width={212} height={84} rx={12} fill="#f59e0b" />
      <rect x={742} y={322} width={42} height={64} rx={10} fill="#d97706" />
      <rect x={662} y={244} width={102} height={74} rx={10} fill="#f59e0b" />
      <rect x={674} y={256} width={78} height={42} rx={5} fill="#bae6fd" />
      <path d="M680 260 l20 0 l-14 34 l-12 0 z" fill="#fff" opacity={0.5} />
      <text x={706} y={372} fontSize={20} fontWeight={800} fill="#92400e" fontFamily="ui-monospace, monospace">
        EX-04
      </text>
      {/* boom + stick + bucket */}
      <polyline points="606,326 520,214 468,330" fill="none" stroke="#f59e0b" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="606,326 520,214 468,330" fill="none" stroke="#d97706" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
      {[[606, 326], [520, 214], [468, 330]].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r={9} fill="#92400e" />
      ))}
      <path d="M452 326 q-6 34 22 50 l34 -6 q-6 -30 -26 -48 z" fill="#475569" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={474 + i * 11} y={372 - i * 2} width={5} height={10} rx={2} fill="#334155" />
      ))}
    </g>
  );
}

function PrinterGlyph({ paper, opacity, taken }: { paper: number; opacity: number; taken: boolean }) {
  // Paper slides up out of the slot (paper: 0..1).
  const h = 92 * paper;
  return (
    <g opacity={opacity}>
      {/* table */}
      <rect x={70} y={378} width={190} height={10} rx={4} fill="#94a3b8" />
      <rect x={84} y={388} width={8} height={FLOOR - 388} fill="#94a3b8" />
      <rect x={238} y={388} width={8} height={FLOOR - 388} fill="#94a3b8" />
      {/* paper behind printer */}
      <g transform={`translate(0 ${-h})`}>
        <rect x={112} y={322} width={106} height={96} rx={3} fill="#fff" stroke="#cbd5e1" />
        {!taken && <Label x={140} y={360} w={34} />}
        <Label x={190} y={360} w={34} />
      </g>
      {/* printer body */}
      <rect x={96} y={322} width={138} height={58} rx={10} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={2} />
      <rect x={108} y={318} width={114} height={8} rx={3} fill="#cbd5e1" />
      <rect x={110} y={348} width={60} height={6} rx={3} fill="#94a3b8" />
      <circle cx={214} cy={351} r={5} fill={paper > 0 && paper < 1 ? "#22c55e" : "#94a3b8"} />
    </g>
  );
}

/* ---------------------------------- Component ---------------------------------- */

export function ScrollStory() {
  const [ref, p] = useScrollProgress<HTMLElement>();
  const step = Math.min(3, Math.floor(p * 4));

  // Scene 1 (0 – .25): photograph
  const flash = window4(p, 0.12, 0.15, 0.15, 0.2);
  // Scene 2 (.25 – .5): print
  const printerIn = seg(p, 0.22, 0.3);
  const paper = ease(seg(p, 0.3, 0.44));
  const grab = seg(p, 0.44, 0.5);
  // Scene 3 (.5 – .75): walk to machine and stick the label
  const walk3 = ease(seg(p, 0.5, 0.63));
  const stick = ease(seg(p, 0.63, 0.7));
  const placed = p >= 0.7;
  const bounce = placed ? 1 + 0.18 * Math.sin(seg(p, 0.7, 0.75) * Math.PI) : 1;
  // Scene 4 (.75 – 1): operator scans
  const aOut = seg(p, 0.75, 0.82);
  const bWalk = ease(seg(p, 0.76, 0.86));
  const bArm = ease(seg(p, 0.86, 0.9));
  const beam = window4(p, 0.89, 0.92, 0.97, 1.01);
  const scanned = p >= 0.93;

  // Worker A
  let aX = 330;
  let aArm = 0.35;
  let aFlip = false;
  let aWalk = 0;
  if (p < 0.25) {
    aArm = lerp(0.35, 2.05, ease(seg(p, 0.02, 0.1)));
  } else if (p < 0.5) {
    aX = lerp(330, 300, seg(p, 0.25, 0.3));
    aFlip = p > 0.27;
    aArm = lerp(0.35, 1.45, ease(seg(p, 0.4, 0.46)));
    aWalk = seg(p, 0.25, 0.3) * 6;
  } else if (p < 0.75) {
    aX = lerp(300, 528, walk3);
    aArm = lerp(0.6, 1.6, stick);
    aWalk = walk3 * 14;
  } else {
    aX = lerp(528, 250, aOut);
    aFlip = aOut > 0 && aOut < 1;
    aArm = 0.35;
    aWalk = aOut * 12;
  }

  // Where the label is: on paper → in A's hand → flying to the machine → stuck on it.
  const spot = { x: 600, y: 352 };
  const handOf = (x: number, arm: number, flip: boolean) => ({ x: x + (flip ? -1 : 1) * (12 + 52 * Math.sin(arm)), y: 300 + 52 * Math.cos(arm) });
  const aHand = handOf(aX, aArm, aFlip);
  let label: { x: number; y: number; w: number } | null = null;
  if (p >= 0.44 && p < 0.63) {
    const fromPaper = { x: 140, y: 360 - 92 };
    const t = ease(grab);
    label = { x: lerp(fromPaper.x, aHand.x, t), y: lerp(fromPaper.y, aHand.y + 14, t), w: lerp(34, 40, t) };
  } else if (p >= 0.63) {
    label = { x: lerp(aHand.x, spot.x, stick), y: lerp(aHand.y + 14, spot.y, stick), w: lerp(40, 52, stick) };
  }

  const bX = lerp(-80, 420, bWalk);

  return (
    <section ref={ref} id="how" className="relative isolate" style={{ height: "420vh" }}>
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-screen" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[900px] max-w-[200vw] -translate-x-1/2 rounded-full bg-gradient-to-b from-primary-100/70 to-transparent blur-3xl" />
      <div className="sticky top-16 flex h-[calc(100vh-4rem)] items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-12">
          {/* Steps */}
          <div className="order-2 lg:order-1">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-500 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary-600" />
              </span>
              QR asset inspections & maintenance
            </p>
            <h1 className="mt-3 text-[1.7rem] font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
              Every machine checked.{" "}
              <span className="bg-gradient-to-r from-primary-600 via-primary-500 to-sky-500 bg-clip-text text-transparent">Every fault on record.</span>
            </h1>
            <p className="mt-3 hidden text-slate-600 sm:block">Photograph it, label it, scan it. Checks, failures and repairs, tracked from any phone.</p>
            <div className="mt-4 flex gap-2 lg:mt-5">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition hover:-translate-y-0.5 hover:bg-primary-700"
              >
                Start free <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#features" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:shadow-md">
                Features
              </a>
            </div>
            <ol className="mt-5 space-y-2 lg:mt-7 lg:space-y-2.5">
              {STEPS.map(({ icon: Icon, title, text }, i) => {
                const active = i === step;
                const done = i < step;
                const fill = clamp(p * 4 - i);
                return (
                  <li
                    key={title}
                    className={cn(
                      "relative overflow-hidden rounded-xl border bg-white px-4 py-3 transition-all duration-500",
                      active ? "border-primary-200 shadow-md" : "border-slate-200",
                      !active && "hidden lg:block lg:opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-500",
                          done ? "bg-emerald-500 text-white" : active ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        <span className="mr-1.5 text-slate-400">{i + 1}.</span>
                        {title}
                      </span>
                    </div>
                    <p className={cn("text-sm leading-relaxed text-slate-600 transition-all duration-500", active ? "mt-2 max-h-24 opacity-100" : "max-h-0 opacity-0")}>{text}</p>
                    <span className="absolute bottom-0 left-0 h-0.5 bg-primary-500" style={{ width: `${fill * 100}%` }} />
                  </li>
                );
              })}
            </ol>
            <p
              className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-opacity duration-500"
              style={{ opacity: p < 0.04 ? 1 : 0.35 }}
            >
              <ChevronsDown className="size-4 animate-bounce text-primary-600" /> Scroll to watch how it works
            </p>
          </div>

          {/* Stage */}
          <div className="order-1 lg:order-2">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-sky-50 via-white to-slate-100 shadow-[0_30px_80px_-30px_rgba(37,99,235,0.35)]">
              <svg viewBox="0 0 900 470" className="block w-full" role="img" aria-label={STEPS[step].title}>
                {/* backdrop: warehouse wall, windows, floor */}
                <rect x={0} y={0} width={900} height={FLOOR} fill="url(#wall)" />
                {[60, 250, 440, 630].map((wx) => (
                  <rect key={wx} x={wx} y={50} width={130} height={70} rx={8} fill="#e0f2fe" stroke="#bae6fd" strokeWidth={2} />
                ))}
                <rect x={0} y={FLOOR} width={900} height={40} fill="#e2e8f0" />
                {Array.from({ length: 12 }, (_, i) => (
                  <rect key={i} x={i * 80 + 20} y={FLOOR + 18} width={40} height={4} rx={2} fill="#facc15" opacity={0.6} />
                ))}
                <defs>
                  <linearGradient id="wall" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#f8fafc" />
                    <stop offset="1" stopColor="#eef2f7" />
                  </linearGradient>
                  <linearGradient id="beam" x1="0" x2="1">
                    <stop offset="0" stopColor="#22c55e" stopOpacity="0.55" />
                    <stop offset="1" stopColor="#22c55e" stopOpacity="0.08" />
                  </linearGradient>
                </defs>

                <Excavator shake={placed && p < 0.75 ? Math.sin(seg(p, 0.7, 0.75) * Math.PI * 4) * 1.5 : 0} />
                <PrinterGlyph paper={paper} opacity={printerIn * (1 - seg(p, 0.6, 0.68))} taken={p >= 0.44} />

                {/* Label */}
                {label && <Label x={label.x} y={label.y} w={label.w} scale={placed ? bounce : 1} glow={scanned ? window4(p, 0.93, 0.95, 0.99, 1.2) : 0} />}

                {/* Scan beam from operator's phone to the label */}
                {beam > 0 && (() => {
                  const hand = handOf(bX, lerp(0.35, 1.75, bArm), false);
                  return <polygon points={`${hand.x + 4},${hand.y - 12} ${spot.x - 30},${spot.y - 36} ${spot.x - 30},${spot.y + 36}`} fill="url(#beam)" opacity={beam} />;
                })()}

                {/* Worker A (registers & labels) */}
                <Person x={aX} vest="#f97316" hat="#facc15" arm={aArm} flip={aFlip} walk={aWalk} opacity={1 - aOut * 0.55}>
                  {p < 0.27 && <PhoneGlyph screen={flash > 0.2 ? "#fff" : "#1e293b"} />}
                </Person>
                {/* Camera flash */}
                {flash > 0 && (
                  <>
                    <circle cx={aHand.x + 4} cy={aHand.y - 12} r={10 + 40 * flash} fill="#fff" opacity={flash} />
                    <rect x={0} y={0} width={900} height={470} fill="#fff" opacity={flash * 0.55} />
                  </>
                )}

                {/* Operator B (scans) */}
                {p > 0.75 && (
                  <Person x={bX} vest="#2563eb" hat="#f8fafc" arm={lerp(0.35, 1.75, bArm)} walk={bWalk * 16}>
                    <PhoneGlyph screen={scanned ? "#22c55e" : "#38bdf8"} />
                  </Person>
                )}
              </svg>

              {/* HUD cards over the stage */}
              <Hud show={window4(p, 0.15, 0.18, 0.23, 0.26)} className="left-[4%] top-[6%]">
                <span className="grid size-8 place-items-center rounded-lg bg-primary-50 text-primary-600">
                  <Camera className="size-4" />
                </span>
                <span>
                  <span className="block text-xs font-semibold text-slate-900">Photo added</span>
                  <span className="block text-[11px] text-slate-500">EX-04 · Excavator</span>
                </span>
              </Hud>
              <Hud show={window4(p, 0.28, 0.31, 0.47, 0.5)} className="left-[4%] top-[6%]">
                <span className="grid size-8 place-items-center rounded-lg bg-primary-50 text-primary-600">
                  <Printer className="size-4" />
                </span>
                <span className="w-32">
                  <span className="block text-xs font-semibold text-slate-900">{paper >= 1 ? "2 labels printed" : "Printing QR labels…"}</span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-primary-600" style={{ width: `${paper * 100}%` }} />
                  </span>
                </span>
              </Hud>
              <Hud show={window4(p, 0.7, 0.72, 0.76, 0.79)} className="right-[4%] top-[6%]">
                <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Check className="size-4" />
                </span>
                <span className="block text-xs font-semibold text-slate-900">Label placed on EX-04</span>
              </Hud>

              {/* Operator's phone screen */}
              <div
                className="absolute left-[4%] top-[6%] w-[34%] max-w-[190px] origin-top-left rounded-[1.1rem] border border-slate-200 bg-white p-1.5 shadow-2xl"
                style={{ opacity: seg(p, 0.9, 0.93), transform: `scale(${0.85 + 0.15 * seg(p, 0.9, 0.93)})` }}
              >
                <div className="rounded-[0.8rem] bg-slate-50 p-2">
                  <p className="font-mono text-[9px] font-semibold text-primary-600 sm:text-[10px]">EX-04</p>
                  <p className="text-[10px] font-semibold text-slate-900 sm:text-xs">Excavator</p>
                  <div className="mt-1.5 space-y-1">
                    {["Tracks & rollers", "No hydraulic leaks", "Bucket teeth secure"].map((q, i) => {
                      const ok = p >= 0.94 + i * 0.015;
                      return (
                        <div key={q} className="flex items-center justify-between gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[8px] text-slate-700 sm:text-[10px]">
                          <span className="truncate">{q}</span>
                          <span className={cn("shrink-0 rounded px-1 font-semibold transition-colors", ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-transparent")}>OK</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className={cn("mt-1.5 flex items-center justify-center gap-1 rounded-md py-1 text-[8px] font-semibold text-white transition-colors sm:text-[10px]", p >= 0.985 ? "bg-emerald-600" : "bg-primary-600")}>
                    <ClipboardCheck className="size-3" /> {p >= 0.985 ? "Check passed" : "Submit check"}
                  </div>
                </div>
              </div>

              {/* Progress along the bottom */}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-200/60">
                <div className="h-full bg-gradient-to-r from-primary-600 to-sky-400" style={{ width: `${p * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Hud({ show, className, children }: { show: number; className: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("pointer-events-none absolute flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-2.5 py-2 shadow-lg backdrop-blur sm:px-3", className)}
      style={{ opacity: show, transform: `translateY(${(1 - show) * 8}px)` }}
    >
      {children}
    </div>
  );
}
