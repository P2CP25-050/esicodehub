import { useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void router.replace('/home');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || isAuthenticated) {
    return <LoadingSpinner message="Checking session..." />;
  }

  return (
    <>
      <Head>
        <title>ESICodeHub — The academic code platform for ESI</title>
        <meta name="description" content="ESICodeHub is the academic code platform built for ESI engineers. Manage assignments, detect plagiarism, and collaborate with precision." />
      </Head>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #060b1e;
          color: #e2e8f0;
          line-height: 1.6;
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes gridPulse {
          0%, 100% { opacity: 0.04; }
          50%       { opacity: 0.08; }
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 0 24px; }
        .nav-link { color: #94a3b8; text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.2s; position: relative; padding-bottom: 4px; }
        .nav-link:hover { color: #f1f5f9; }
        .nav-link-active { color: #f1f5f9; }
        .nav-link-active::after { content: ''; position: absolute; bottom: -4px; left: 0; right: 0; height: 2px; background: #4f6cf7; border-radius: 1px; }
        .btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 11px 22px; background: #4f6cf7; color: #fff; font-weight: 600; font-size: 0.9rem; border: none; border-radius: 8px; cursor: pointer; text-decoration: none; transition: background 0.2s, transform 0.2s, box-shadow 0.2s; white-space: nowrap; }
        .btn-primary:hover { background: #3d5ce0; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(79,108,247,0.35); }
        .btn-secondary { display: inline-flex; align-items: center; gap: 8px; padding: 11px 22px; background: rgba(255,255,255,0.06); color: #e2e8f0; font-weight: 600; font-size: 0.9rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; cursor: pointer; text-decoration: none; transition: background 0.2s, border-color 0.2s, transform 0.2s; white-space: nowrap; }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.22); transform: translateY(-1px); }
        .feature-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; transition: border-color 0.3s, background 0.3s, transform 0.3s, box-shadow 0.3s; }
        .feature-card:hover { border-color: rgba(79,108,247,0.4); background: rgba(255,255,255,0.05); transform: translateY(-3px); box-shadow: 0 16px 40px rgba(0,0,0,0.35); }
        .problem-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 28px; transition: border-color 0.3s, background 0.3s; }
        .problem-card:hover { border-color: rgba(79,108,247,0.3); background: rgba(255,255,255,0.04); }
        .metric-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 24px 20px; }
        .how-steps-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 48px; align-items: start; }
        .step-item { text-align: center; padding: 12px 8px; }
        .step-badge {
          width: 108px;
          height: 108px;
          margin: 0 auto 34px;
          border-radius: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #bcc7f7;
          font-family: 'JetBrains Mono', Consolas, monospace;
          font-size: 1.15rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          background: linear-gradient(180deg, rgba(46, 58, 95, 0.72) 0%, rgba(25, 33, 61, 0.82) 100%);
          border: 1px solid rgba(131, 155, 240, 0.28);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 50px rgba(0,0,0,0.18);
        }
        .step-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(1.2rem, 1.9vw, 1.6rem);
          line-height: 1.15;
          font-weight: 800;
          color: #f5f7ff;
          max-width: 12ch;
          margin: 0 auto 18px;
        }
        .step-desc {
          color: #8f9cbf;
          font-size: 1rem;
          line-height: 1.7;
          max-width: 22ch;
          margin: 0 auto;
        }
        @media (max-width: 1024px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-mockup { display: none !important; }
          .features-bento { grid-template-columns: 1fr !important; }
          .bento-left { grid-row: auto !important; }
          .bento-bottom-row { grid-template-columns: 1fr 1fr !important; }
          .problems-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .how-steps-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
          .solution-inner { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .footer-grid { grid-template-columns: 1fr !important; }
          .stats-mini { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .nav-links { display: none !important; }
          .hero-ctas { flex-direction: column !important; align-items: stretch !important; }
          .hero-ctas a, .hero-ctas button { justify-content: center !important; }
          .bento-bottom-row { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ background: '#060b1e', minHeight: '100vh', color: '#e2e8f0' }}>

        {/* NAV */}
        <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(6,11,30,0.92)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '68px' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: '#f1f5f9', fontWeight: 700, fontSize: '1.1rem' }}>
              <div style={{ width: '32px', height: '32px', position: 'relative' }}>
                <Image src="/esicodehub-logo.png" alt="ESICodeHub" fill style={{ objectFit: 'contain' }} priority />
              </div>
              ESICodeHub
            </Link>
            <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
              <a href="#features" className="nav-link nav-link-active">Features</a>
              <a href="#how-it-works" className="nav-link">How it works</a>
              <a href="#why-it-exists" className="nav-link">Why it exists</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Link href="/login" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#f1f5f9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}>
                Sign in
              </Link>
              <Link href="/register" className="btn-primary" style={{ padding: '8px 20px', borderRadius: '20px' }}>Sign up</Link>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section style={{ paddingTop: '120px', paddingBottom: '100px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(59,108,247,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(59,108,247,0.05) 1px, transparent 1px)', backgroundSize: '52px 52px', animation: 'gridPulse 6s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '10%', left: '2%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(79,108,247,0.07) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '5%', right: '2%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(79,108,247,0.05) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />
          <div className="container" style={{ position: 'relative', zIndex: 1 }}>
            <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>
              <div>
                <div style={{ marginBottom: '24px', animation: 'fadeSlideUp 0.6s ease 0ms both' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '100px', padding: '6px 14px' }}>
                    ÉCOLE SUPÉRIEURE D&apos;INFORMATIQUE · ALGIERS
                  </span>
                </div>
                <h1 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', fontWeight: 800, lineHeight: 1.15, marginBottom: '20px', animation: 'fadeSlideUp 0.6s ease 80ms both' }}>
                  The academic code workspace<br /><span style={{ color: '#4f6cf7' }}>built for ESI.</span>
                </h1>
                <p style={{ fontSize: '1rem', color: '#94a3b8', lineHeight: 1.78, marginBottom: '32px', maxWidth: '490px', animation: 'fadeSlideUp 0.6s ease 160ms both' }}>
                  Use one ESI-only platform to share personal code submissions, submit coursework, ask technical questions in the forum, and follow professor feedback and plagiarism checks. Access is limited to @esi.dz accounts.
                </p>
                <div className="hero-ctas" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', animation: 'fadeSlideUp 0.6s ease 240ms both' }}>
                  <Link href="/login" className="btn-primary">
                    Sign in with ESI email
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z" /></svg>
                  </Link>
                  <button className="btn-secondary" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Learn more</button>
                </div>
              </div>
              <div className="hero-mockup" style={{ animation: 'float 8s ease-in-out infinite' }}>
                <div style={{ background: '#0d1117', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 28px 80px rgba(0,0,0,0.65)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#161b22', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', gap: '7px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f57' }} />
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#febc2e' }} />
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#28c840' }} />
                    </div>
                    <span style={{ fontSize: '0.72rem', letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase', fontWeight: 500 }}>MERGE_SORT.PY — ESICODEHUB</span>
                    <div style={{ width: '48px' }} />
                  </div>
                  <div style={{ padding: '20px 20px 14px', fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace", fontSize: '0.82rem', lineHeight: 1.85 }}>
                    {([
                      { n: '01', tokens: [{ t: 'def ', c: '#c678dd' }, { t: 'merge_sort', c: '#61afef' }, { t: '(arr):', c: '#abb2bf' }] },
                      { n: '02', tokens: [{ t: '  if ', c: '#c678dd' }, { t: 'len', c: '#56b6c2' }, { t: '(arr) <= ', c: '#abb2bf' }, { t: '1', c: '#d19a66' }, { t: ':', c: '#abb2bf' }] },
                      { n: '03', tokens: [{ t: '    return ', c: '#c678dd' }, { t: 'arr', c: '#abb2bf' }] },
                      { n: '04', tokens: [{ t: '  mid = ', c: '#abb2bf' }, { t: 'len', c: '#56b6c2' }, { t: '(arr) // ', c: '#abb2bf' }, { t: '2', c: '#d19a66' }] },
                      { n: '05', tokens: [{ t: '  left = ', c: '#abb2bf' }, { t: 'merge_sort', c: '#61afef' }, { t: '(arr[:mid])', c: '#abb2bf' }] },
                      { n: '06', tokens: [{ t: '  right = ', c: '#abb2bf' }, { t: 'merge_sort', c: '#61afef' }, { t: '(arr[mid:])', c: '#abb2bf' }] },
                      { n: '07', tokens: [{ t: '  return ', c: '#c678dd' }, { t: 'merge', c: '#61afef' }, { t: '(left, right)', c: '#abb2bf' }] },
                      { n: '08', tokens: [{ t: '', c: '' }] },
                      { n: '09', tokens: [{ t: '# \u2713 Submitted \u00b7 Prof. Amrani \u00b7 3 comments', c: '#4d5566' }] },
                    ] as { n: string; tokens: { t: string; c: string }[] }[]).map((line) => (
                      <div key={line.n} style={{ display: 'flex', gap: '16px' }}>
                        <span style={{ color: '#2d3748', minWidth: '18px', userSelect: 'none', flexShrink: 0 }}>{line.n}</span>
                        <span>{line.tokens.map((tok, i) => <span key={i} style={{ color: tok.c }}>{tok.t}</span>)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <span style={{ color: '#2d3748', minWidth: '18px', userSelect: 'none', flexShrink: 0 }}>10</span>
                      <span style={{ display: 'inline-block', width: '8px', height: '1em', background: '#4f6cf7', verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: '#161b22', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.7rem', color: '#4d5566', letterSpacing: '0.06em' }}>
                    <span>PYTHON · UTF-8</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
                      <span>REVIEWED · GRADE: 17/20</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" style={{ paddingTop: '100px', paddingBottom: '100px' }}>
          <div className="container">
            <div style={{ marginBottom: '48px', textAlign: 'center' }}>
              <h2 style={{ fontSize: 'clamp(1.7rem, 2.8vw, 2.7rem)', fontWeight: 900, lineHeight: 1.15, color: '#eef3ff', fontFamily: "'Playfair Display', Georgia, serif" }}>Everything you need</h2>
            </div>
            <div className="features-bento" style={{ display: 'grid', gridTemplateColumns: '1fr 1.65fr', gap: '14px' }}>
              <div className="feature-card bento-left" style={{ gridRow: '1 / 3', padding: '28px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '44px', height: '44px', background: 'rgba(79,108,247,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4f6cf7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9l3 3-3 3" /><line x1="13" y1="15" x2="17" y2="15" /></svg>
                </div>
                <p style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '10px' }}>FOR EVERYONE</p>
                <h3 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '12px', lineHeight: 1.2 }}>Code Sharing</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.75, marginBottom: '28px' }}>Create personal code submissions with title, language, and files. Mark each submission as public or private, then browse shared public submissions.</p>
                <div style={{ flex: 1, borderRadius: '10px', overflow: 'hidden', minHeight: '200px', position: 'relative', background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Image src="/codeimage.png" alt="Code Example" fill style={{ objectFit: 'cover' }} />
                </div>
              </div>
              <div className="feature-card" style={{ padding: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '10px' }}>STUDENTS + PROFESSORS</p>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.2, marginBottom: '12px' }}>Assignment Submissions</h3>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.75 }}>Professors publish assignments with deadlines, languages, and class targeting (year, section, group). Students upload files, and late status is tracked per submission.</p>
                  </div>
                  <div style={{ width: '52px', height: '52px', flexShrink: 0, background: 'rgba(79,108,247,0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f6cf7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><path d="M11 8v6M8 11h6" /></svg>
                  </div>
                </div>
              </div>
              <div className="bento-bottom-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="feature-card" style={{ padding: '48px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <div style={{ width: '56px', height: '56px', background: 'rgba(79,108,247,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4f6cf7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  </div>
                  <p style={{ fontSize: '0.68rem', letterSpacing: '0.1em', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>FOR PROFESSORS</p>
                  <h4 style={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1.3 }}>Plagiarism Detection</h4>
                </div>
                <div className="feature-card" style={{ padding: '48px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <div style={{ width: '56px', height: '56px', background: 'rgba(79,108,247,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4f6cf7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><circle cx="3" cy="12" r="2" /><circle cx="21" cy="12" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="12" cy="21" r="2" /><line x1="5" y1="12" x2="9" y2="12" /><line x1="15" y1="12" x2="19" y2="12" /><line x1="12" y1="5" x2="12" y2="9" /><line x1="12" y1="15" x2="12" y2="19" /></svg>
                  </div>
                  <p style={{ fontSize: '0.68rem', letterSpacing: '0.1em', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>FORUM + ASSIGNMENTS</p>
                  <h4 style={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1.3 }}>Peer Review</h4>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WHY IT EXISTS */}
        <section id="why-it-exists" style={{ paddingTop: '84px', paddingBottom: '84px' }}>
          <div className="container">
            <div style={{ marginBottom: '34px', textAlign: 'center' }}>
              <h2 style={{ fontSize: 'clamp(1.7rem, 2.8vw, 2.7rem)', fontWeight: 900, lineHeight: 1.15, color: '#eef3ff', fontFamily: "'Playfair Display', Georgia, serif" }}>The problem with code at ESI</h2>
            </div>
            <div className="problems-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '44px' }}>
              {([
                {
                  num: '01',
                  title: 'No visibility',
                  desc: 'We can\'t centrally see what\'s out there, and feedback gets lost across silos and becomes difficult to track throughout the lifecycle.',
                  icon: <svg key="p1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a8b7ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
                },
                {
                  num: '02',
                  title: 'No standard way',
                  desc: 'Manual or ad-hoc methods, no clear standards, and one-off fixes no one reuses and no integration into our workflow.',
                  icon: <svg key="p2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a8b7ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>,
                },
                {
                  num: '03',
                  title: 'Isolated solutions',
                  desc: 'Solutions are IP and team-bound, hard to reuse in other systems, often custom and get risky without oversight or cross-team consistency.',
                  icon: <svg key="p3" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a8b7ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
                },
              ] as { num: string; title: string; desc: string; icon: React.ReactElement }[]).map((item) => (
                <article key={item.num} style={{
                  background: 'linear-gradient(160deg, rgba(22,31,62,0.94) 0%, rgba(10,18,43,0.94) 100%)',
                  border: '1px solid rgba(79,108,247,0.45)',
                  borderRadius: '16px',
                  padding: '24px 22px 22px',
                  minHeight: '0',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(8,14,34,0.5)', display: 'grid', placeItems: 'center' }}>{item.icon}</div>
                    <span style={{ fontSize: '1.45rem', fontWeight: 700, color: '#2c3554', fontFamily: "'JetBrains Mono',Consolas,monospace", letterSpacing: '0.03em' }}>{item.num}</span>
                  </div>
                  <h3 style={{ fontSize: 'clamp(1.1rem, 1.6vw, 1.35rem)', lineHeight: 1.2, marginBottom: '10px', fontWeight: 700, color: '#f1f5f9', fontFamily: "'Playfair Display', Georgia, serif" }}>{item.title}</h3>
                  <p style={{ fontSize: '0.86rem', lineHeight: 1.7, color: '#97a5c2' }}>{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* THE SOLUTION HEADER */}
        <div id="solution-anchor" style={{ paddingTop: '84px' }}>
          <div className="container">
            <div style={{ marginBottom: '26px', textAlign: 'center' }}>
              <h2 style={{ fontSize: 'clamp(1.7rem, 2.8vw, 2.7rem)', fontWeight: 900, lineHeight: 1.15, color: '#eef3ff', fontFamily: "'Playfair Display', Georgia, serif" }}>The Solution</h2>
            </div>
          </div>
        </div>

        {/* THE SOLUTION */}
        <section id="solution" style={{ paddingBottom: '84px' }}>
          <div className="container">
            <div style={{
              background: 'linear-gradient(150deg, rgba(8,17,49,0.96) 0%, rgba(5,11,33,0.96) 100%)',
              border: '1px solid rgba(79,108,247,0.42)',
              borderRadius: '22px',
              padding: '52px 38px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', right: '2%', bottom: '-10%', width: '340px', height: '340px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,108,247,0.20) 0%, transparent 68%)', filter: 'blur(16px)', pointerEvents: 'none' }} />
              <div className="solution-inner" style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: '30px', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                <div>
                  
                  <h2 style={{ fontSize: 'clamp(1.6rem, 2.8vw, 2.7rem)', lineHeight: 1.15, marginBottom: '18px', fontWeight: 900, color: '#eef3ff', fontFamily: "'Playfair Display', Georgia, serif", maxWidth: '22ch' }}>
                    A supervised academic code platform, built exclusively for ESI.
                  </h2>
                  <p style={{ fontSize: '0.92rem', lineHeight: 1.75, color: '#9aa9c6', maxWidth: '52ch' }}>
                    ESICodeHub centralizes assignment submissions, plagiarism reporting, professor feedback, and forum discussions in one interface used by ESI students and professors.
                  </p>
                </div>
                <div className="stats-mini" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {([
                    { value: '99.9%', label: 'UPTIME SLA' },
                    { value: '< 50ms', label: 'SEARCH LATENCY' },
                    { value: 'AES-256', label: 'ENCRYPTION' },
                    { value: '100+', label: 'LANGUAGES' },
                  ] as { value: string; label: string }[]).map((stat) => (
                    <div key={stat.label} style={{ background: 'linear-gradient(180deg, rgba(27,39,76,0.85) 0%, rgba(20,30,62,0.82) 100%)', border: '1px solid rgba(79,108,247,0.45)', borderRadius: '16px', padding: '22px 20px', minHeight: '112px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#b4c1f2', marginBottom: '6px', fontFamily: "'JetBrains Mono',Consolas,monospace" }}>{stat.value}</div>
                      <div style={{ fontSize: '0.68rem', color: '#627399', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS HEADER */}
        <div style={{ paddingTop: '96px' }}>
          <div className="container">
            <div className="space-y-4" style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ fontSize: 'clamp(1.7rem, 2.8vw, 2.7rem)', fontWeight: 900, lineHeight: 1.15, color: '#eef3ff', fontFamily: "'Playfair Display', Georgia, serif", maxWidth: '22ch', margin: '0 auto' }}>
                How it works
              </h2>
            </div>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <section id="how-it-works" style={{ paddingBottom: '112px', background: 'rgba(255,255,255,0.01)' }}>
          <div className="container">
            <div className="space-y-4" style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h3 style={{ fontSize: 'clamp(1.2rem, 2.7vw, 1.9rem)', fontWeight: 900, lineHeight: 1.2, fontFamily: "'Playfair Display', Georgia, serif" }}>Understand ESICodeHub in three steps</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '520px', margin: '0 auto' }}>Three steps to technical mastery through a supervised academic environment.</p>
            </div>
            <div className="how-steps-grid" style={{ marginTop: '58px' }}>
              {([
                { num: '01', title: 'Sign in with your ESI email', desc: 'Access is limited to @esi.dz accounts so coursework and discussions stay inside the school community.' },
                { num: '02', title: 'Share code or submit assignments', desc: 'Create personal submissions, upload assignment files before deadlines, and organize work by language and course.' },
                { num: '03', title: 'Get feedback and track progress', desc: 'Read professor reviews, follow assignment status, and use forum discussions to solve technical blockers faster.' },
              ] as { num: string; title: string; desc: string }[]).map((step) => (
                <div key={step.num} className="step-item">
                  <div className="step-badge">{step.num}</div>
                  <h4 className="step-title">{step.title}</h4>
                  <p className="step-desc">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ paddingTop: '100px', paddingBottom: '100px' }}>
          <div className="container">
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '80px 40px', textAlign: 'center' }}>
              
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, lineHeight: 1.2, marginBottom: '20px' }}>Join the ESI academic<br />code community</h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '480px', margin: '0 auto 40px', lineHeight: 1.78 }}>Sign in with your ESI email to access submissions, assignments, and collaboration tools designed for your academic environment.</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/login" className="btn-primary" style={{ padding: '13px 28px', fontSize: '0.95rem' }}>
                  Sign in with ESI email
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                </Link>
                <button className="btn-secondary" style={{ padding: '13px 28px', fontSize: '0.95rem' }}>Explore Library</button>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ background: '#040810', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '60px', paddingBottom: '36px' }}>
          <div className="container">
            <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '48px', marginBottom: '48px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ width: '28px', height: '28px', position: 'relative' }}>
                    <Image src="/esicodehub-logo.png" alt="ESICodeHub" fill style={{ objectFit: 'contain' }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>ESICodeHub</span>
                </div>
                <p style={{ color: '#3d4455', fontSize: '0.875rem', lineHeight: 1.75, maxWidth: '250px' }}>Restricted to @esi.dz accounts. Built with precision for the ESI community. Used by students and professors.</p>
              </div>
              <div>
                <h5 style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, marginBottom: '18px' }}>PLATFORM</h5>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {([{ label: 'Features', href: '#features' }, { label: 'Solution', href: '#solution-anchor' }] as { label: string; href: string }[]).map((item) => (
                    <li key={item.label}><a href={item.href} style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#e2e8f0'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}>{item.label}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, marginBottom: '18px' }}>LEGAL</h5>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(['Privacy Policy', 'Terms'] as string[]).map((item) => (
                    <li key={item}><a href="#" onClick={(e) => e.preventDefault()} style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#e2e8f0'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}>{item}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, marginBottom: '18px' }}>SOCIAL</h5>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(['GitHub', 'LinkedIn'] as string[]).map((item) => (
                    <li key={item}><a href="#" onClick={(e) => e.preventDefault()} style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#e2e8f0'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}>{item}</a></li>
                  ))}
                </ul>
              </div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '28px' }}>
              <span style={{ color: '#2d3748', fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>© 2026 ESICODEHUB. ALL RIGHTS RESERVED.</span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
