import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Code2,
  Lock,
  MessageCircle,
  MessageSquareText,
  PlusCircle,
  Shield,
  UploadCloud,
  Users,
} from 'lucide-react';

import { useAuth } from '../hooks/useAuth';

const HERO_DOT_PATTERN =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27%3E%3Ccircle cx=%272%27 cy=%272%27 r=%271.15%27 fill=%27%23ffffff%27 fill-opacity=%270.04%27/%3E%3C/svg%3E")';

const HERO_CODE = `01 class ESIKernel:
02     def validate_submission(self, user):
03         if user.domain != "esi.dz":
04             raise DomainError()
05         return self.audit_code(user.payload)`;

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;

type Feature = {
  icon: IconType;
  tag: string;
  title: string;
  description: string;
};

type Stat = {
  value: string;
  label: string;
};

type Step = {
  icon: IconType;
  title: string;
  detail: string;
};

type HowItWorksStepProps = {
  step: Step;
  index: number;
  observerReady: boolean;
  isVisible: boolean;
  registerRef: (node: HTMLDivElement | null) => void;
};

const STATS: Stat[] = [
  { value: '100%', label: '@esi.dz accounts only' },
  { value: 'AST', label: 'Similarity detection engine' },
  { value: '< 30s', label: 'Average submission flow' },
  { value: 'Trace', label: 'Audit history retained' },
];

const SOCIAL_PROOF_STATS: Stat[] = [
  { value: 'Median 42s', label: 'Submission workflow completion' },
  { value: 'AST-based', label: 'Structural similarity analysis engine' },
  { value: 'Audit-ready', label: 'Every submission attributed and timestamped' },
];

const FEATURES: Feature[] = [
  {
    icon: Code2,
    tag: 'Core',
    title: 'Code Sharing',
    description:
      'Upload and share source code with syntax highlighting and controlled visibility for coursework review.',
  },
  {
    icon: Calendar,
    tag: 'Assignments',
    title: 'Submission Tracking',
    description:
      'Submit to professor-created assignments with deadline awareness and timestamped version history.',
  },
  {
    icon: Shield,
    tag: 'Integrity',
    title: 'Plagiarism Detection',
    description:
      'Automated AST-based structural similarity analysis supports evidence-based academic decisions.',
  },
  {
    icon: MessageSquareText,
    tag: 'Feedback',
    title: 'Peer Review',
    description:
      'Inline comments and structured review threads keep professor guidance attached to each submission.',
  },
];

const HOW_IT_WORKS: Step[] = [
  {
    icon: PlusCircle,
    title: 'Create Assignment Scope',
    detail:
      'Define assignment requirements, constraints, and deadlines before publication to students.',
  },
  {
    icon: UploadCloud,
    title: 'Upload Submission Files',
    detail:
      'Students submit source files and metadata with timestamped attribution preserved automatically.',
  },
  {
    icon: BarChart3,
    title: 'Run Similarity Analysis',
    detail:
      'AST comparison highlights structural overlaps so faculty can review suspicious pairs quickly.',
  },
  {
    icon: MessageCircle,
    title: 'Deliver Review Feedback',
    detail:
      'Structured comments remain attached to each submission, enabling accountable academic follow-up.',
  },
];

function HeroTerminal() {
  const lines = HERO_CODE.split('\n');

  const getLineStyle = (line: string): CSSProperties => {
    if (line.startsWith('class ') || line.startsWith('def ')) return { color: '#93c5fd' };
    if (line.startsWith('if ')) return { color: '#c4b5fd' };
    if (line.startsWith('raise ')) return { color: '#fca5a5' };
    if (line.startsWith('return ')) return { color: '#86efac' };
    if (line.startsWith('+')) return { color: '#86efac' };
    if (line.startsWith('-')) return { color: '#fca5a5' };
    if (line.startsWith('diff') || line.startsWith('@@')) return { color: '#93c5fd' };
    return { color: '#94a3b8' };
  };

  const renderCodeLine = (line: string) => {
    const numberedLine = line.match(/^(\d{2})(\s+)(.*)$/);

    if (!numberedLine) {
      return <span style={getLineStyle(line)}>{line || '\u00a0'}</span>;
    }

    const [, lineNumber, spacing, code] = numberedLine;

    return (
      <>
        <span style={{ color: '#64748b' }}>{lineNumber}</span>
        {spacing}
        <span style={getLineStyle(code)}>{code || '\u00a0'}</span>
      </>
    );
  };

  return (
    <div
      className="rounded-xl border border-white/10 bg-slate-900/65 shadow-[0_20px_50px_rgba(2,8,23,0.35)] backdrop-blur-sm"
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
    >
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400/70" />
        <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
        <span className="h-3 w-3 rounded-full bg-green-400/70" />
        <span className="ml-auto text-xs text-slate-500">submissions.py - ESIcodeHub</span>
      </div>
      <div className="overflow-hidden p-5 text-xs leading-relaxed">
        {lines.map((line, index) => (
          <div key={index}>
            {renderCodeLine(line)}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatStrip() {
  return (
    <section className="border-y border-white/8 bg-[#0d1b2a]">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-px bg-white/5 md:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-[#0d1b2a] px-6 py-6 text-center">
              <p className="mono-heading text-2xl font-extrabold text-white md:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;

  return (
    <article className="feature-card group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div
        aria-hidden
        className="feature-hover-overlay pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,rgba(37,99,235,0.04)_0%,transparent_60%)] opacity-0"
      />
      <div className="relative flex items-start justify-between">
        <div className="feature-icon-shell flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {feature.tag}
        </span>
      </div>
      <div className="relative">
        <h3 className="text-lg font-bold text-slate-900">{feature.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
      </div>
    </article>
  );
}

function HowItWorksStep({
  step,
  index,
  observerReady,
  isVisible,
  registerRef,
}: HowItWorksStepProps) {
  const Icon = step.icon;

  return (
    <article
      ref={registerRef}
      data-step-index={index}
      className={`how-step rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${
        observerReady && !isVisible ? 'how-step-hidden' : 'how-step-visible'
      }`}
      style={observerReady ? { transitionDelay: `${index * 100}ms` } : undefined}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900">{step.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.detail}</p>
    </article>
  );
}

function SocialProofStrip() {
  return (
    <section className="bg-[#0a1520] px-6 py-10 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-xl rounded-xl border border-white/10 bg-white/3 p-4 text-center">
          {SOCIAL_PROOF_STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={`py-3 ${
                index !== SOCIAL_PROOF_STATS.length - 1 ? 'border-b border-white/10' : ''
              }`}
            >
              <p className="mono-heading text-lg font-semibold text-white">{stat.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-300">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [observerReady, setObserverReady] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState<boolean[]>(() =>
    HOW_IT_WORKS.map(() => false)
  );
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/home');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const onScroll = () => setHasScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setVisibleSteps(HOW_IT_WORKS.map(() => true));
      return;
    }

    setObserverReady(true);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const indexRaw = (entry.target as HTMLElement).dataset.stepIndex;
          if (!indexRaw) return;

          const index = Number(indexRaw);
          if (Number.isNaN(index)) return;

          setVisibleSteps((previous) => {
            if (previous[index]) return previous;
            const next = [...previous];
            next[index] = true;
            return next;
          });

          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -10% 0px',
      }
    );

    stepRefs.current.forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

        :root {
          --bg-dark: #0d1b2a;
          --accent: #2563eb;
          --text-muted: #64748b;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          font-family: 'DM Sans', sans-serif;
        }

        .mono-heading {
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: -0.02em;
        }

        @media (prefers-reduced-motion: no-preference) {
          @keyframes fade-slide-up {
            from {
              opacity: 0;
              transform: translateY(16px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .hero-fade-item {
            animation: fade-slide-up 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }

          .hero-delay-0 {
            animation-delay: 0ms;
          }

          .hero-delay-1 {
            animation-delay: 80ms;
          }

          .hero-delay-2 {
            animation-delay: 160ms;
          }

          .hero-delay-3 {
            animation-delay: 240ms;
          }

          .section-fade {
            animation: fade-slide-up 460ms ease-out both;
          }

          .section-delay-1 {
            animation-delay: 70ms;
          }

          .section-delay-2 {
            animation-delay: 130ms;
          }

          .feature-card {
            transition: transform 180ms ease-out, box-shadow 180ms ease-out,
              border-color 180ms ease-out;
          }

          .feature-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 18px 32px rgba(15, 23, 42, 0.12);
            border-color: rgba(37, 99, 235, 0.25);
          }

          .feature-icon-shell {
            transition: transform 150ms ease-out, background-color 150ms ease-out,
              color 150ms ease-out, border-color 150ms ease-out;
          }

          .feature-card:hover .feature-icon-shell {
            transform: scale(1.06);
            background-color: rgba(37, 99, 235, 0.16);
            color: rgb(29, 78, 216);
            border-color: rgba(37, 99, 235, 0.35);
          }

          .feature-hover-overlay {
            transition: opacity 150ms ease-out;
          }

          .feature-card:hover .feature-hover-overlay {
            opacity: 1;
          }

          .hero-cta-glow {
            transition: opacity 150ms ease-out;
          }

          .hero-primary-group:hover .hero-cta-glow {
            opacity: 1;
          }

          .how-step {
            transition: opacity 500ms ease-out, transform 500ms ease-out,
              box-shadow 180ms ease-out;
          }

          .how-step:hover {
            box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
          }

          .how-step-hidden {
            opacity: 0;
            transform: translateY(20px);
          }

          .how-step-visible {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <header
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          hasScrolled
            ? 'border-b border-white/10 bg-[#0d1b2a]/95 backdrop-blur-md'
            : 'bg-transparent'
        }`}
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
          <Link href="/" className="inline-flex items-center gap-2.5 text-white">
            <Image
              src="/esicodehub-logo.png"
              alt="ESIcodeHub"
              width={80}
              height={21}
              priority
            />

          </Link>

          <Link
            href="/login"
            className="rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/10"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        <section className="relative min-h-screen overflow-hidden bg-[#0d1b2a] px-6 pb-20 pt-32 text-white md:px-10 md:pt-36">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: HERO_DOT_PATTERN }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_20%,rgba(37,99,235,0.22),transparent_70%)]"
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16">
            <div>
              <div className="hero-fade-item hero-delay-0 mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">
                ESI Algiers - Academic Platform
              </div>

              <h1 className="mono-heading hero-fade-item hero-delay-1 text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
                The code platform built for ESI.
              </h1>

              <p className="hero-fade-item hero-delay-2 mt-6 text-lg leading-relaxed text-slate-300 md:text-xl">
                A dedicated academic environment for supervised code sharing,
                assignment workflows, and transparent departmental oversight.
              </p>

              <div className="hero-fade-item hero-delay-3 mt-9 flex flex-wrap items-center gap-3">
                <span className="hero-primary-group relative inline-flex">
                  <span
                    aria-hidden
                    className="hero-cta-glow pointer-events-none absolute inset-x-6 -bottom-1 h-3 rounded-full bg-blue-500/40 opacity-0 blur-md"
                  />
                  <Link
                    href="/login"
                    className="relative inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-500"
                  >
                    Sign in with ESI email
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </Link>
                </span>
                <button
                  type="button"
                  onClick={scrollToFeatures}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/5"
                >
                  Learn more
                </button>
              </div>
            </div>

            <div className="hidden md:block">
              <HeroTerminal />
            </div>
          </div>
        </section>

        <div className="section-fade section-delay-1">
          <StatStrip />
        </div>

        <section className="section-fade section-delay-1 bg-slate-50 px-6 py-24 md:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 text-xs font-bold uppercase tracking-widest text-blue-600">
              Why ESIcodeHub
            </div>
            <h2 className="mono-heading max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Reliable infrastructure for academic code review.
            </h2>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              <article className="rounded-2xl border border-red-100 border-t-2 border-t-red-500 bg-red-50/60 p-7">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700">
                  <AlertTriangle className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Professors can&apos;t trust what they grade.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Investigating AI-generated code consumes hours that should go toward
                  feedback. There is no audit trail, no history, and no context.
                </p>
              </article>

              <article className="rounded-2xl border border-amber-100 border-t-2 border-t-amber-500 bg-amber-50/60 p-7">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-700">
                  <Users className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Students need safe collaboration channels.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Work-sharing often happens off-platform and without supervision,
                  making legitimate collaboration difficult to distinguish from misuse.
                </p>
              </article>

              <article className="rounded-2xl border border-emerald-100 border-t-2 border-t-emerald-500 bg-emerald-50/60 p-7">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">ESIcodeHub closes both gaps.</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Full visibility for professors, with a legitimate and supervised
                  collaboration space for students.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="features" className="section-fade section-delay-2 bg-white px-6 py-24 md:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 text-xs font-bold uppercase tracking-widest text-blue-600">
              Features
            </div>
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
              <h2 className="mono-heading max-w-xl text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
                Everything the department needs.
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-slate-500 md:text-right">
                Built specifically for the ESI academic workflow, not a generic code-hosting platform.
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <FeatureCard key={feature.title} feature={feature} />
              ))}
            </div>
          </div>
        </section>

        <div className="section-fade section-delay-2">
          <SocialProofStrip />
        </div>

        <section className="bg-slate-50 px-6 py-24 md:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 text-xs font-bold uppercase tracking-widest text-blue-600">
              How it works
            </div>
            <h2 className="mono-heading mb-14 max-w-xl text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              From assignment to feedback, one platform.
            </h2>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map((step, index) => (
                <HowItWorksStep
                  key={step.title}
                  step={step}
                  index={index}
                  observerReady={observerReady}
                  isVisible={visibleSteps[index]}
                  registerRef={(node) => {
                    stepRefs.current[index] = node;
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0d1b2a] px-6 py-20 text-center md:px-10">
          <div className="relative mx-auto max-w-2xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(37,99,235,0.18),transparent_70%)]"
            />
            <p className="relative mono-heading text-xs font-semibold uppercase tracking-widest text-blue-400">
              ESIcodeHub - @esi.dz only
            </p>
            <h2 className="relative mono-heading mt-5 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Ready to submit your first assignment?
            </h2>
            <p className="relative mt-4 text-base leading-relaxed text-slate-400">
              Use your institutional email to sign in and start submitting under supervised academic workflow.
            </p>
            <Link
              href="/login"
              className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-500"
            >
              Sign in with ESI email
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
        </section>

        <section className="bg-[#0a1520] px-6 py-3.5 md:px-10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100">
              <Lock className="h-4 w-4" strokeWidth={1.8} />
              Restricted to @esi.dz
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100">
              <Code2 className="h-4 w-4" strokeWidth={1.8} />
              Built by ESI students
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100">
              <Calendar className="h-4 w-4" strokeWidth={1.8} />
              Academic year 2025-2026
            </span>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-[linear-gradient(to_bottom,#0a1520,#0d1b2a)] px-6 py-10 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5 text-white">
                <Image
                  src="/esicodehub-logo.png"
                  alt="ESIcodeHub"
                  width={100}
                  height={26}
                />
                <span className="mono-heading text-sm font-semibold">ESIcodeHub</span>
              </Link>
              <p className="mt-4 text-xs text-slate-400">ESIcodeHub © 2026 ESI</p>
            </div>

            <div className="flex gap-12 text-sm">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">Platform</p>
                <Link href="/submissions" className="text-slate-300 transition hover:text-white">
                  Submissions
                </Link>
                <Link href="/login" className="text-slate-300 transition hover:text-white">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}