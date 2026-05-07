import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// ─── Animated counter hook ───────────────────────────────────────────────────
function useCounter(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;

    let start: number | null = null;
    let cancelled = false;
    let frameId: number | null = null;

    const step = (timestamp: number) => {
      if (cancelled) return;
      if (!start) start = timestamp;

      const progress = Math.min((timestamp - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(ease * target));

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else if (!cancelled) {
        setCount(target);
      }
    };

    frameId = requestAnimationFrame(step);

    return () => {
      cancelled = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [started, target, duration]);

  return { count, start: () => setStarted(true) };
}

// ─── Intersection observer hook ──────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

// ─── Static code snippet for hero mockup ─────────────────────────────────────
const CODE_LINES = [
  { tokens: [{ t: 'kw', v: 'def ' }, { t: 'fn', v: 'merge_sort' }, { t: 'tx', v: '(arr):' }] },
  { tokens: [{ t: 'tx', v: '    ' }, { t: 'kw', v: 'if ' }, { t: 'fn', v: 'len' }, { t: 'tx', v: '(arr) <= ' }, { t: 'nu', v: '1' }, { t: 'tx', v: ':' }] },
  { tokens: [{ t: 'tx', v: '        ' }, { t: 'kw', v: 'return ' }, { t: 'tx', v: 'arr' }] },
  { tokens: [{ t: 'tx', v: '    mid = ' }, { t: 'fn', v: 'len' }, { t: 'tx', v: '(arr) // ' }, { t: 'nu', v: '2' }] },
  { tokens: [{ t: 'tx', v: '    left  = ' }, { t: 'fn', v: 'merge_sort' }, { t: 'tx', v: '(arr[:mid])' }] },
  { tokens: [{ t: 'tx', v: '    right = ' }, { t: 'fn', v: 'merge_sort' }, { t: 'tx', v: '(arr[mid:])' }] },
  { tokens: [{ t: 'kw', v: '    return ' }, { t: 'fn', v: 'merge' }, { t: 'tx', v: '(left, right)' }] },
  { tokens: [] },
  { tokens: [{ t: 'cm', v: '# ✓ Submitted · Prof. Amrani · 3 comments' }] },
];

const TOKEN_COLORS: Record<string, string> = {
  kw: '#818cf8', fn: '#34d399', nu: '#c084fc',
  cm: '#475569', tx: '#cbd5e1',
};

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const featuresRef = useRef<HTMLElement>(null);

  // Auth redirect
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void router.replace('/home');
    }
  }, [isAuthenticated, isLoading, router]);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Stats counters
  const students  = useCounter(1000);
  const snippets  = useCounter(20000);
  const professors = useCounter(50);

  const statsRef = useInView();
  useEffect(() => {
    if (statsRef.inView) {
      students.start();
      snippets.start();
      professors.start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsRef.inView]);

  // Prevent rendering the landing UI while session state is unresolved
  // or while redirecting authenticated users to home.
  if (isLoading || isAuthenticated) {
    return <LoadingSpinner message="Checking session..." />;
  }

  return (
    <>
      <Head>
        <title>Home — ESICodeHub</title>
        <meta name="description" content="Share code, submit assignments, and collaborate transparently under academic supervision at École Supérieure d'Informatique." />
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Outfit', sans-serif; background: #0d1b2a; color: #e2e8f0; overflow-x: hidden; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes gridPulse {
          0%, 100% { opacity: .045; }
          50%       { opacity: .08; }
        }
        @keyframes floatCode {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50%       { transform: translateY(-12px) rotate(-1deg); }
        }
        @keyframes scanline {
          0%   { top: -2px; }
          100% { top: 100%; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .reveal {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity .65s ease, transform .65s ease;
        }
        .reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .hero-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(59,130,246,.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,.055) 1px, transparent 1px);
          background-size: 52px 52px;
          animation: gridPulse 6s ease-in-out infinite;
        }

        .noise {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='.035'/%3E%3C/svg%3E");
          pointer-events: none;
        }

        .code-window {
          animation: floatCode 7s ease-in-out infinite;
        }
        .code-window::after {
          content: '';
          position: absolute;
          left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(99,102,241,.7), transparent);
          animation: scanline 4s linear infinite;
        }

        .cursor-blink {
          display: inline-block;
          width: 2px;
          height: 1em;
          background: #60a5fa;
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: blink 1s step-end infinite;
        }

        .feature-card:hover .feature-icon-wrap {
          transform: scale(1.1) rotate(-4deg);
        }

        .problem-card {
          transition: transform .25s ease, box-shadow .25s ease;
        }
        .problem-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(0,0,0,.3);
        }

        .nav-link {
          position: relative;
          color: #94a3b8;
          font-size: .875rem;
          font-weight: 500;
          text-decoration: none;
          transition: color .2s;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -2px; left: 0; right: 100%;
          height: 1.5px;
          background: #60a5fa;
          transition: right .25s ease;
        }
        .nav-link:hover { color: #e2e8f0; }
        .nav-link:hover::after { right: 0; }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: .75rem 1.75rem;
          background: #2563eb;
          color: #fff;
          font-weight: 700;
          font-size: .9375rem;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: background .2s, transform .2s, box-shadow .2s;
          box-shadow: 0 0 0 0 rgba(59,130,246,0);
        }
        .btn-primary:hover {
          background: #1d4ed8;
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(59,130,246,.45);
        }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: .75rem 1.75rem;
          background: transparent;
          color: #94a3b8;
          font-weight: 600;
          font-size: .9375rem;
          border-radius: 10px;
          border: 1.5px solid rgba(148,163,184,.25);
          cursor: pointer;
          text-decoration: none;
          transition: all .2s;
        }
        .btn-secondary:hover {
          color: #e2e8f0;
          border-color: rgba(148,163,184,.55);
          transform: translateY(-2px);
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#0d1b2a' }}>

        {/* ════════════════ NAV ════════════════ */}
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 max(1.5rem, calc(50% - 680px))',
          height: 64,
          borderBottom: '1px solid rgba(255,255,255,.06)',
          background: 'rgba(13,27,42,.85)',
          backdropFilter: 'blur(16px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image
                src="/esicodehub-logo.png"
                alt="ESICodeHub Logo"
                width={32}
                height={32}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '.9rem', color: '#e2e8f0' }}>
              ESICodeHub
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <a href="#features" className="nav-link">Features</a>
            <Link href="/register" className="nav-link">Sign up</Link>
            <Link href="/login" className="btn-primary" style={{ padding: '.45rem 1.25rem', fontSize: '.875rem' }}>
              Sign in
            </Link>
          </div>
        </nav>

        {/* ════════════════ HERO ════════════════ */}
        <section style={{
          minHeight: '100vh',
          display: 'flex', alignItems: 'center',
          padding: '0 max(1.5rem, calc(50% - 680px))',
          paddingTop: 64,
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(160deg, #0d1b2a 0%, #0f2035 60%, #0d1b2a 100%)',
        }}>
          <div className="hero-grid" />
          <div className="noise" />

          {/* Radial glows */}
          <div style={{ position: 'absolute', top: '15%', left: '5%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(37,99,235,.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(79,70,229,.1) 0%, transparent 65%)', pointerEvents: 'none' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center', width: '100%', paddingTop: '3rem', paddingBottom: '4rem' }}>

            {/* Left — copy */}
            <div>
              {/* ESI badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(37,99,235,.1)', border: '1px solid rgba(37,99,235,.3)',
                borderRadius: 100, padding: '5px 14px 5px 8px',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '.72rem', color: '#60a5fa',
                marginBottom: '1.5rem',
                animation: 'fadeUp .5s ease both',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', boxShadow: '0 0 8px #3b82f6' }} />
                  École Supérieure d&apos;Informatique · Algiers
              </div>

              {/* Headline */}
              <h1 style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 'clamp(2.8rem, 4.5vw, 4rem)',
                fontWeight: 400,
                lineHeight: 1.1,
                letterSpacing: '-.02em',
                color: '#f1f5f9',
                marginBottom: '1.25rem',
                animation: 'fadeUp .6s ease .08s both',
              }}>
                The code platform<br />
                <em style={{ fontStyle: 'italic', color: '#93c5fd' }}>built for ESI.</em>
              </h1>

              {/* Subheadline */}
              <p style={{
                fontSize: '1.1rem',
                color: '#64748b',
                lineHeight: 1.75,
                maxWidth: 460,
                marginBottom: '2rem',
                animation: 'fadeUp .6s ease .16s both',
              }}>
                Share code, submit assignments, and collaborate transparently under academic supervision — all in one place built exclusively for{' '}
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>@esi.dz</span> accounts.
              </p>

              {/* CTAs */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2.5rem', animation: 'fadeUp .6s ease .24s both' }}>
                <Link href="/login" className="btn-primary">
                  Sign in with ESI email
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z"/>
                  </svg>
                </Link>
                <button onClick={scrollToFeatures} className="btn-secondary">
                  Learn more
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 2a.75.75 0 0 1 .75.75v8.69l3.22-3.22a.749.749 0 1 1 1.06 1.06l-4.5 4.5a.749.749 0 0 1-1.06 0l-4.5-4.5a.749.749 0 1 1 1.06-1.06l3.22 3.22V2.75A.75.75 0 0 1 8 2Z"/>
                  </svg>
                </button>
              </div>

              {/* Trust signals */}
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', animation: 'fadeUp .6s ease .32s both' }}>
                {[
                  { icon: '🔒', label: '@esi.dz only' },
                  { icon: '🎓', label: 'Academic use' },
                  { icon: '⚡', label: 'Free to use' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8125rem', color: '#475569' }}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — code mockup */}
            <div style={{ animation: 'fadeIn .8s ease .3s both', position: 'relative' }}>
              <div className="code-window" style={{
                background: 'rgba(9,15,32,.96)',
                border: '1px solid rgba(59,130,246,.2)',
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: '0 0 0 1px rgba(59,130,246,.06), 0 32px 80px rgba(0,0,0,.6), 0 0 60px rgba(59,130,246,.08)',
                position: 'relative',
              }}>
                {/* Titlebar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid rgba(59,130,246,.08)', background: 'rgba(6,12,26,.8)' }}>
                  {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
                  <span style={{ marginLeft: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: '.7rem', color: '#334155' }}>
                    merge_sort.py — ESICodeHub
                  </span>
                </div>

                {/* Code body */}
                <div style={{ padding: '1.25rem 1.5rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '.78rem', lineHeight: 1.9 }}>
                  {CODE_LINES.map((line, li) => (
                    <div key={li} style={{ display: 'flex', alignItems: 'baseline' }}>
                      <span style={{ width: 28, color: '#1e3a5f', fontSize: '.7rem', userSelect: 'none', flexShrink: 0 }}>{li + 1}</span>
                      <span>
                        {line.tokens.map((tok, ti) => (
                          <span key={ti} style={{ color: TOKEN_COLORS[tok.t] ?? '#cbd5e1' }}>{tok.v}</span>
                        ))}
                        {li === CODE_LINES.length - 1 && <span className="cursor-blink" />}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Status bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: 'rgba(6,12,26,.7)', borderTop: '1px solid rgba(59,130,246,.06)', fontFamily: "'JetBrains Mono', monospace", fontSize: '.65rem', color: '#1e3a5f' }}>
                  <span>Python · UTF-8</span>
                  <span style={{ color: '#22c55e' }}>● Reviewed · Grade: 17/20</span>
                </div>
              </div>

              {/* Floating badges */}
              <div style={{
                position: 'absolute', top: -16, right: -16,
                background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)',
                borderRadius: 10, padding: '8px 14px',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '.72rem', color: '#4ade80',
                backdropFilter: 'blur(8px)',
                animation: 'slideIn .5s ease .6s both',
              }}>
                ✓ Submitted on time
              </div>
              <div style={{
                position: 'absolute', bottom: 40, left: -20,
                background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.3)',
                borderRadius: 10, padding: '8px 14px',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '.72rem', color: '#a5b4fc',
                backdropFilter: 'blur(8px)',
                animation: 'slideIn .5s ease .75s both',
              }}>
                3 inline comments
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════ STATS STRIP ════════════════ */}
        <div ref={statsRef.ref} style={{
          borderTop: '1px solid rgba(255,255,255,.06)',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          background: 'rgba(255,255,255,.02)',
          padding: '2.5rem max(1.5rem, calc(50% - 680px))',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '2rem',
        }}>
          {[
            { value: students.count, suffix: '+', label: 'ESI students' },
            { value: snippets.count, suffix: '+', label: 'Code snippets shared' },
            { value: professors.count, suffix: '', label: 'Professors active' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 'clamp(2.2rem, 3vw, 3rem)',
                fontWeight: 400,
                background: 'linear-gradient(135deg, #93c5fd, #818cf8)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {stat.value.toLocaleString()}{stat.suffix}
              </div>
              <div style={{ fontSize: '.85rem', color: '#475569', marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ════════════════ PROBLEM / SOLUTION ════════════════ */}
        <section style={{
          padding: '6rem max(1.5rem, calc(50% - 680px))',
          background: '#f8fafc',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '.72rem', color: '#3b82f6', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 12 }}>
                {'// why it exists'}
            </div>
            <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 'clamp(1.9rem, 3vw, 2.75rem)', fontWeight: 400, color: '#0f172a', lineHeight: 1.2 }}>
              The problem with code at ESI
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            {[
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                ),
                color: '#ef4444',
                title: 'No visibility',
                body: "Professors receive assignments as email attachments or through ad-hoc tools. There's no history, no version tracking, and no structured way to give line-by-line feedback.",
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 12s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                  </svg>
                ),
                color: '#f59e0b',
                title: 'AI-generated code',
                body: 'Without a structured submission system, detecting AI-generated or copied code is manual and time-consuming — professors spend hours investigating instead of teaching.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                ),
                color: '#3b82f6',
                title: 'Isolated students',
                body: "Students have no shared space to learn from each other's code under academic supervision. Collaboration happens informally, without structure or accountability.",
              },
            ].map(card => (
              <div key={card.title} className="problem-card" style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                padding: '2rem',
                borderTop: `3px solid ${card.color}`,
              }}>
                <div style={{ color: card.color, marginBottom: 16 }}>{card.icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', marginBottom: 10 }}>{card.title}</h3>
                <p style={{ fontSize: '.875rem', color: '#64748b', lineHeight: 1.7 }}>{card.body}</p>
              </div>
            ))}
          </div>

          {/* Arrow pointing down to solution */}
          <div style={{ textAlign: 'center', margin: '2.5rem 0' }}>
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '.75rem', color: '#94a3b8', letterSpacing: '.1em' }}>ESICodeHub solves this</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            </div>
          </div>

          {/* Solution card */}
          <div style={{
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            border: '1px solid rgba(59,130,246,.2)',
            borderRadius: 20,
            padding: '2.5rem 3rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '3rem',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '.72rem', color: '#3b82f6', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 12 }}>
                  {'// the solution'}
              </div>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.75rem', fontWeight: 400, color: '#f1f5f9', lineHeight: 1.3, marginBottom: 16 }}>
                A supervised academic code platform, built exclusively for ESI.
              </h3>
              <p style={{ color: '#64748b', fontSize: '.9rem', lineHeight: 1.75 }}>
                ESICodeHub gives professors structured visibility into every submission, automated plagiarism detection, and inline feedback tools — while giving students a space to share, learn, and collaborate under real academic supervision.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {[
                { label: 'Structured submissions', icon: '📋' },
                { label: 'AST plagiarism detection', icon: '🔍' },
                { label: 'Inline code review', icon: '✏️' },
                { label: 'Full audit trail', icon: '🗂️' },
              ].map(item => (
                <div key={item.label} style={{
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid rgba(255,255,255,.07)',
                  borderRadius: 12,
                  padding: '1rem',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{item.icon}</div>
                  <div style={{ fontSize: '.8rem', color: '#94a3b8', lineHeight: 1.4 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════ FEATURES ════════════════ */}
        <section ref={featuresRef as React.RefObject<HTMLElement>} id="features" style={{
          padding: '6rem max(1.5rem, calc(50% - 680px))',
          background: '#0d1b2a',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '.72rem', color: '#3b82f6', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 12 }}>
                {'// features'}
            </div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(1.9rem, 3vw, 2.75rem)', fontWeight: 400, color: '#f1f5f9', lineHeight: 1.2 }}>
                Everything you need, nothing you don&apos;t
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
            {[
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                  </svg>
                ),
                color: '#3b82f6', colorBg: 'rgba(59,130,246,.1)',
                title: 'Code Sharing',
                desc: 'Upload and share source code with syntax highlighting across 20+ languages. Set visibility to public for the community or private for personal use.',
                tag: 'For everyone',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                ),
                color: '#10b981', colorBg: 'rgba(16,185,129,.1)',
                title: 'Assignment Submissions',
                desc: 'Professors create structured assignments with deadlines. Students submit code directly — with version history, late submission tracking, and per-assignment targeting by year and section.',
                tag: 'Students + Professors',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                  </svg>
                ),
                color: '#f59e0b', colorBg: 'rgba(245,158,11,.1)',
                title: 'Plagiarism Detection',
                desc: 'Automated AST-based similarity analysis powered by MOSS. Professors get detailed reports comparing all submissions for a given assignment — in seconds, not hours.',
                tag: 'For professors',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                ),
                color: '#8b5cf6', colorBg: 'rgba(139,92,246,.1)',
                title: 'Peer & Professor Review',
                desc: 'Inline line-by-line comments directly on code, structured grading with grade/20, and general feedback — all visible to the student in one clean interface.',
                tag: 'For professors',
              },
            ].map(feat => (
              <div key={feat.title} className="feature-card" style={{
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 16,
                padding: '2rem',
                transition: 'border-color .25s, background .25s',
                cursor: 'default',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,.3)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.07)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.03)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div className="feature-icon-wrap" style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: feat.colorBg,
                    color: feat.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform .25s ease',
                    flexShrink: 0,
                  }}>
                    {feat.icon}
                  </div>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '.65rem', color: '#475569',
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(255,255,255,.07)',
                    borderRadius: 6, padding: '3px 8px',
                  }}>
                    {feat.tag}
                  </span>
                </div>
                <h3 style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f1f5f9', marginBottom: 10 }}>{feat.title}</h3>
                <p style={{ fontSize: '.875rem', color: '#475569', lineHeight: 1.7 }}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════ TRUST STRIP ════════════════ */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,.06)',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          background: 'rgba(255,255,255,.015)',
          padding: '1.25rem max(1.5rem, calc(50% - 680px))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '2.5rem', flexWrap: 'wrap',
        }}>
          {[
            'Restricted to @esi.dz accounts',
            'Built by ESI students',
            'Academic year 2025–2026',
          ].map((item, i) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: i > 0 ? '2.5rem' : 0 }}>
              {i > 0 && <span style={{ color: '#1e3a5f', fontSize: '.75rem' }}>·</span>}
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '.75rem', color: '#334155', letterSpacing: '.05em' }}>
                {item}
              </span>
            </div>
          ))}
        </div>

        {/* ════════════════ CTA SECTION ════════════════ */}
        <section style={{
          padding: '6rem max(1.5rem, calc(50% - 680px))',
          background: '#0d1b2a',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: 600, margin: '0 auto',
            background: 'linear-gradient(135deg, rgba(37,99,235,.08), rgba(79,70,229,.08))',
            border: '1px solid rgba(59,130,246,.18)',
            borderRadius: 24,
            padding: '3.5rem 2.5rem',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,.12), transparent 65%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '.72rem', color: '#3b82f6', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 16 }}>
                  {'// ready to start?'}
              </div>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 400, color: '#f1f5f9', lineHeight: 1.2, marginBottom: 14 }}>
                Join the ESI academic<br />code community
              </h2>
              <p style={{ color: '#475569', fontSize: '.9375rem', lineHeight: 1.7, marginBottom: '2rem', maxWidth: 420, margin: '0 auto 2rem' }}>
                Sign in with your ESI email to access submissions, assignments, and collaboration tools designed for your academic environment.
              </p>
              <Link href="/login" className="btn-primary" style={{ fontSize: '1rem', padding: '.85rem 2.25rem' }}>
                Sign in with ESI email →
              </Link>
            </div>
          </div>
        </section>

        {/* ════════════════ FOOTER ════════════════ */}
        <footer style={{
          borderTop: '1px solid rgba(255,255,255,.06)',
          padding: '2rem max(1.5rem, calc(50% - 680px))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem',
          background: 'rgba(0,0,0,.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image
                src="/esicodehub-logo.png"
                alt="ESICodeHub Logo"
                width={24}
                height={24}
                style={{ objectFit: 'contain' }}
              />
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '.8rem', color: '#334155' }}>
              ESICodeHub © {new Date().getFullYear()}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {[
              { label: 'Submissions', href: '/submissions' },
              { label: 'Sign in', href: '/login' },
            ].map(link => (
              <Link key={link.href} href={link.href} style={{ fontSize: '.8125rem', color: '#334155', textDecoration: 'none', transition: 'color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
                onMouseLeave={e => (e.currentTarget.style.color = '#334155')}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </footer>

      </div>
    </>
  );
}