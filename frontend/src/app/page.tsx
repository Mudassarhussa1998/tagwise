import Link from "next/link";
import { Suspense } from "react";
import { Show } from "@clerk/nextjs";
import {
  ArrowRight,
  BellRing,
  Building2,
  Camera,
  Check,
  ChevronDown,
  ClipboardCheck,
  Factory,
  FileSpreadsheet,
  FileText,
  HardHat,
  History,
  MessageCircleWarning,
  Printer,
  QrCode,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Truck,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { LiveFeed } from "@/components/landing/Demos";
import { CountUp, Reveal, ScrollHeader } from "@/components/landing/Motion";
import { ScrollStory } from "@/components/landing/ScrollStory";
import { Logo } from "@/components/ui";

const INDUSTRIES = [
  { icon: Warehouse, label: "Warehouses & logistics" },
  { icon: HardHat, label: "Construction" },
  { icon: Factory, label: "Manufacturing" },
  { icon: Truck, label: "Fleets & vehicles" },
  { icon: Building2, label: "Facilities" },
  { icon: Stethoscope, label: "Medical equipment" },
];

const FEATURES = [
  { icon: Smartphone, title: "Checks in about a minute", text: "Big tap targets and remembered names make daily checks effortless on the shop floor." },
  { icon: Camera, title: "Failure reports with photos", text: "Mark severity (minor, needs repair, unsafe) and attach evidence. Unsafe reports take the asset out of service." },
  { icon: History, title: "Digital health record", text: "Every inspection, failure, repair and status change, linked to the asset forever." },
  { icon: BellRing, title: "Issues that can't slip", text: "Failed checks and out-of-service assets open issues automatically, and they close only when maintenance is recorded." },
  { icon: Printer, title: "Print-ready labels & PDFs", text: "Actual-size QR labels with cut lines, and audit-ready reports with page numbers and a sign-off block." },
  { icon: Users, title: "Teams & secure sign-in", text: "Admins and members, email invites, Google sign-in and MFA, powered by Clerk." },
];

const USE_CASES = [
  { icon: Warehouse, title: "Warehouses & logistics", text: "Forklifts, reach trucks, dock levellers and racking: pre-shift checks without the clipboard." },
  { icon: HardHat, title: "Construction sites", text: "Cranes, mixers, generators and scaffolding inspected daily, with evidence for safety audits." },
  { icon: Factory, title: "Manufacturing", text: "Presses, conveyors and compressors: catch leaks and wear before they stop production." },
  { icon: Truck, title: "Fleets & vehicles", text: "Walk-around checks for vans, trucks and buses, with defects reported straight from the yard." },
  { icon: Building2, title: "Facilities", text: "Fire extinguishers, HVAC, lifts and emergency lighting: proof of every inspection." },
  { icon: Stethoscope, title: "Medical & lab equipment", text: "Regular checks and service history for devices that must always be ready." },
];

const FAQ = [
  { q: "Do operators need to install an app or create an account?", a: "No. They point their phone camera at the QR label and the check opens in the browser. Only supervisors and managers sign in." },
  { q: "What are the two QR codes on each asset for?", a: "The Check QR opens the checklist and failure form for operators. The Report QR opens a read-only history of the asset (checks, issues, repairs) for supervisors, auditors or clients. Admins can reset the report link at any time." },
  { q: "What happens when someone reports a problem?", a: "An issue is opened, the asset's status changes (Needs attention, or Out of service if unsafe) and it appears on the dashboard and Issues list right away. Recording maintenance resolves it and puts the asset back in operation." },
  { q: "Can I customise what gets checked?", a: "Yes. Every asset has its own checklist. Edit it any time; past inspections keep the questions they were answered with, so history stays accurate." },
  { q: "Can I print reports for audits?", a: "Yes. The asset report prints as a clean multi-page document with summary numbers, inspection and maintenance tables, a QR back to the live report, and a reviewer sign-off." },
  { q: "Is my data secure?", a: "Dashboard access is protected by Clerk with verified emails. Each company's data is isolated, and QR links use long random tokens that can't be guessed." },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
      {children}
    </p>
  );
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: React.ReactNode; text?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-slate-600">{text}</p>}
    </Reveal>
  );
}

// Clerk's <Show> reads the session at request time, so it streams in behind Suspense.
function SignedOutLinks() {
  return (
    <>
      <Link href="/sign-in" className="rounded-md px-3 py-2 font-medium text-slate-700 hover:text-slate-900">
        Log in
      </Link>
      <Link href="/sign-up" className="rounded-lg bg-primary-600 px-3.5 py-2 font-medium text-white shadow-sm shadow-primary-600/30 transition hover:bg-primary-700">
        Start free
      </Link>
    </>
  );
}

export default function Home() {
  return (
    <div className="overflow-x-clip bg-white">
      <ScrollHeader>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            {[
              ["#how", "How it works"],
              ["#features", "Features"],
              ["#use-cases", "Use cases"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="hidden rounded-md px-3 py-2 text-slate-600 transition hover:text-slate-900 lg:block">
                {label}
              </a>
            ))}
            <Suspense fallback={<SignedOutLinks />}>
              <Show when="signed-out">
                <SignedOutLinks />
              </Show>
              <Show when="signed-in">
                <Link href="/dashboard" className="rounded-lg bg-primary-600 px-3.5 py-2 font-medium text-white shadow-sm hover:bg-primary-700">
                  Open dashboard
                </Link>
              </Show>
            </Suspense>
          </nav>
        </div>
      </ScrollHeader>

      {/* ---------- Hero: scroll-driven story ---------- */}
      <ScrollStory />

      {/* ---------- Industries marquee ---------- */}
      <section className="border-y border-slate-200/70 bg-slate-50/70 py-6">
        <p className="mb-4 px-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Built for teams that run on equipment</p>
        <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
          <div className="animate-marquee flex w-max gap-4 pr-4 hover:[animation-play-state:paused]">
            {[...INDUSTRIES, ...INDUSTRIES].map(({ icon: Icon, label }, i) => (
              <span key={i} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
                <Icon className="size-4 text-primary-600" /> {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Before / after ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="The cost of staying the same"
          title="Less time searching. More time producing."
          text="Paper checklists get lost, chat messages get buried, and nobody knows when a machine was last inspected until it breaks."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Without Tagwise</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">Search. Ask. Reconstruct.</p>
              <ul className="mt-6 space-y-3.5">
                {[
                  { icon: FileSpreadsheet, text: "Checklists on paper and spreadsheets nobody reads" },
                  { icon: MessageCircleWarning, text: "Failures reported in chats, then forgotten" },
                  { icon: History, text: "Asset history rebuilt from memory before an audit" },
                  { icon: X, text: "Problems found only when the line stops" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex gap-3 text-slate-600">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-200/70 text-slate-500">
                      <Icon className="size-4" />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="h-full rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-6 shadow-[0_20px_50px_-24px_rgba(37,99,235,0.45)] sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary-700">With Tagwise</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">Open. See. Decide.</p>
              <ul className="mt-6 space-y-3.5">
                {[
                  "Checks done from a phone in about a minute",
                  "Every failure becomes a tracked issue with photos",
                  "Full history one scan away, printable for audits",
                  "Supervisors see problems the moment they're found",
                ].map((t) => (
                  <li key={t} className="flex gap-3 text-slate-700">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-600 text-white">
                      <Check className="size-4" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading eyebrow="Features" title={<>Everything your floor needs. Nothing it doesn&apos;t.</>} />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Reveal className="md:col-span-2 lg:row-span-2">
            <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-primary-50/60 p-6 sm:p-8">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-600 text-white">
                <QrCode className="size-5" />
              </span>
              <h3 className="mt-5 text-2xl font-bold text-slate-900">Two QR codes on every asset</h3>
              <p className="mt-2 max-w-lg text-slate-600">
                One for the people who use the machine, one for the people who need to know about it. Print both on one sheet, at actual size, with cut lines.
              </p>
              <div className="mt-8 grid flex-1 grid-cols-1 content-center gap-4 sm:grid-cols-2">
                {[
                  { title: "SCAN TO CHECK", sub: "Checklist & failure form", band: "bg-primary-600 text-white", icon: ClipboardCheck },
                  { title: "SCAN FOR REPORT", sub: "Read-only full history", band: "border-b border-primary-100 bg-primary-50 text-primary-700", icon: FileText },
                ].map(({ title, sub, band, icon: Icon }, i) => (
                  <div key={title} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <div className={`flex items-center gap-2 px-4 py-2.5 ${band}`}>
                      <Icon className="size-4" />
                      <span>
                        <span className="block text-xs font-extrabold tracking-wider">{title}</span>
                        <span className="block text-[10px] opacity-80">{sub}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-4 p-4">
                      <div className="grid size-20 shrink-0 grid-cols-5 gap-0.5 rounded-md border border-slate-200 p-1.5" aria-hidden>
                        {Array.from({ length: 25 }, (_, n) => (
                          <span key={n} className={(n * 7 + i * 3) % 3 === 0 || [0, 4, 20].includes(n) ? "rounded-[1px] bg-slate-900" : ""} />
                        ))}
                      </div>
                      <div>
                        <p className="font-mono text-lg font-bold text-slate-900">FL-08</p>
                        <p className="text-xs text-slate-500">Toyota forklift</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={(i % 3) * 100}>
              <div className="group h-full rounded-2xl border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-xl">
                <span className="grid size-10 place-items-center rounded-xl bg-primary-50 text-primary-600 transition duration-300 group-hover:bg-primary-600 group-hover:text-white">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Live demo ---------- */}
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-slate-50 to-white py-20 sm:py-24">
        <div className="bg-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>See it react</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">One finding. The whole operation knows.</h2>
            <p className="mt-4 max-w-md text-slate-600">
              The moment an operator taps &quot;Not OK&quot;, the asset changes status, an issue opens, and the dashboard updates for every supervisor, live.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              {[
                ["Was the control done?", "Date, time and result in one record."],
                ["Who performed it?", "A name on every check, repair and status change."],
                ["What was found?", "Notes and photos linked to the asset."],
                ["Can I prove it?", "Printable, audit-ready reports in one click."],
              ].map(([q, a]) => (
                <li key={q} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary-600" />
                  <span>
                    <span className="font-semibold text-slate-900">{q}</span> {a}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <LiveFeed />
          </Reveal>
        </div>
      </section>

      {/* ---------- Numbers ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 lg:grid-cols-4">
          {[
            { value: <><span className="mr-0.5 text-slate-400">~</span><CountUp to={60} suffix="s" /></>, label: "per daily check" },
            { value: <CountUp to={0} />, label: "apps for operators to install" },
            { value: <CountUp to={2} />, label: "QR codes per asset" },
            { value: <CountUp to={100} suffix="%" />, label: "of checks traceable" },
          ].map(({ value, label }, i) => (
            <Reveal key={label} delay={i * 90} className="bg-white">
              <div className="px-4 py-8 text-center">
                <p className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{value}</p>
                <p className="mt-2 text-sm text-slate-500">{label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Use cases ---------- */}
      <section id="use-cases" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-6 sm:pb-24">
        <SectionHeading eyebrow="Use cases" title="If it can break, it can be tagged." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={(i % 3) * 100}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="absolute -right-8 -top-8 size-28 rounded-full bg-primary-50 transition-transform duration-500 group-hover:scale-150" />
                <Icon className="relative size-7 text-primary-600" />
                <h3 className="relative mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="relative mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="scroll-mt-20 bg-slate-50/70 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHeading eyebrow="FAQ" title="Questions, answered." />
          <div className="mt-10 space-y-3">
            {FAQ.map(({ q, a }, i) => (
              <Reveal key={q} delay={i * 60}>
                <details className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 transition open:shadow-md sm:px-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown className="size-5 shrink-0 text-slate-400 transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="px-4 py-20 sm:px-6 sm:py-24">
        <Reveal className="mx-auto max-w-6xl">
          <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-600 to-sky-500 px-6 py-14 text-center shadow-2xl shadow-primary-600/30 sm:px-12 sm:py-20">
            <div className="pointer-events-none absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(rgb(255_255_255/0.5)_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="pointer-events-none absolute -left-20 -top-20 -z-10 size-72 rounded-full bg-white/15 blur-3xl" />
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-5xl">Stop asking what happened. Start seeing it.</h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-100">Create your first asset, print its QR labels and complete the first check today.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-primary-700 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                Start free <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/sign-in" className="inline-flex items-center justify-center rounded-xl border border-white/40 px-6 py-3.5 font-semibold text-white transition hover:bg-white/10">
                Log in
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-slate-200/70">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-slate-500">QR-based inspections, failure reporting and maintenance history for teams that run on equipment.</p>
          </div>
          {[
            { title: "Product", links: [["#how", "How it works"], ["#features", "Features"], ["#faq", "FAQ"]] },
            { title: "Use cases", links: [["#use-cases", "Warehouses"], ["#use-cases", "Construction"], ["#use-cases", "Manufacturing"]] },
            { title: "Account", links: [["/sign-up", "Start free"], ["/sign-in", "Log in"], ["/dashboard", "Dashboard"]] },
          ].map(({ title, links }) => (
            <div key={title}>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                {links.map(([href, label]) => (
                  <li key={label}>
                    <a href={href} className="transition hover:text-primary-700">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200/70 px-4 py-5 text-center text-xs text-slate-400">Tagwise · Operational control for companies</div>
      </footer>
    </div>
  );
}
