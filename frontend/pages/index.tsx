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

  // Auth redirect
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void router.replace('/home');
    }
  }, [isAuthenticated, isLoading, router]);

  // Prevent rendering the landing UI while session state is unresolved
  // or while redirecting authenticated users to home.
  if (isLoading || isAuthenticated) {
    return <LoadingSpinner message="Checking session..." />;
  }

  return (
    <>
      <Head>
        <title>Home — ESICodeHub</title>
        <meta name="description" content="ESICodeHub is the academic code platform built for ESI engineers. Manage assignments, detect plagiarism, and collaborate with precision." />
      </Head>

      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #0a0e27;
          color: #e2e8f0;
          line-height: 1.6;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 20px;
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 28px;
          background: #4f46e5;
          color: #fff;
          font-weight: 600;
          font-size: 0.95rem;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .btn-primary:hover {
          background: #4338ca;
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(79, 70, 229, 0.3);
        }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 28px;
          background: transparent;
          color: #e2e8f0;
          font-weight: 600;
          font-size: 0.95rem;
          border: 1.5px solid #475569;
          border-radius: 10px;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .btn-secondary:hover {
          border-color: #94a3b8;
          color: #f1f5f9;
          transform: translateY(-2px);
        }
      `}</style>

      <div style={{ background: '#0a0e27', minHeight: '100vh', color: '#e2e8f0' }}>
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* NAVIGATION */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <nav style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'rgba(10, 14, 39, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        }}>
          <div className="container" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '70px',
          }}>
            {/* Logo */}
            <Link href="/" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              color: '#f1f5f9',
              fontWeight: 700,
              fontSize: '1.2rem',
            }}>
              <div style={{ width: '32px', height: '32px', position: 'relative' }}>
                <Image
                  src="/esicodehub-logo.png"
                  alt="ESICodeHub"
                  fill
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </div>
              EsiCodeHub
            </Link>

            {/* Nav Links */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '40px',
            }}>
              <a href="#features" style={{
                color: '#94a3b8',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: 500,
                transition: 'color 0.2s',
              }} onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                Features
              </a>
              <a href="#" onClick={(e) => e.preventDefault()} style={{
                color: '#94a3b8',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: 500,
                transition: 'color 0.2s',
                cursor: 'pointer',
              }} onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                Solutions
              </a>
              <a href="#" onClick={(e) => e.preventDefault()} style={{
                color: '#94a3b8',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: 500,
                transition: 'color 0.2s',
                cursor: 'pointer',
              }} onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                Resources
              </a>
            </div>

            {/* CTA Button */}
            <Link href="/login" className="btn-primary" style={{
              padding: '10px 24px',
              fontSize: '0.9rem',
            }}>
              Get Started
            </Link>
          </div>
        </nav>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* HERO SECTION */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <section style={{
          paddingTop: '140px',
          paddingBottom: '100px',
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0a0e27 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Background decorations */}
          <div style={{
            position: 'absolute',
            top: '20%',
            left: '10%',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(79, 70, 229, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none',
            filter: 'blur(40px)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '10%',
            right: '5%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none',
            filter: 'blur(40px)',
          }} />

          <div className="container" style={{
            position: 'relative',
            zIndex: 1,
          }}>
            {/* Badge */}
            <div style={{
              textAlign: 'center',
              marginBottom: '30px',
              animation: 'fadeInUp 0.6s ease',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.75rem',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#4f46e5',
                fontWeight: 600,
              }}>
                ● BUILT FOR ESI ENGINEERS
              </span>
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: 'clamp(2.5rem, 6vw, 3.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: '20px',
              lineHeight: 1.2,
              animation: 'fadeInUp 0.6s ease 0.1s both',
            }}>
              The academic code platform<br />
              <span style={{ color: '#4f46e5' }}>for the next generation of</span><br />
              engineers.
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: '1.1rem',
              color: '#94a3b8',
              textAlign: 'center',
              maxWidth: '700px',
              margin: '0 auto 40px',
              lineHeight: 1.7,
              animation: 'fadeInUp 0.6s ease 0.2s both',
            }}>
              Manage assignments, automate plagiarism detection, and deliver high-quality feedback — all in one centralized platform built for ESI university.
            </p>

            {/* CTAs */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              flexWrap: 'wrap',
              marginBottom: '60px',
              animation: 'fadeInUp 0.6s ease 0.3s both',
            }}>
              <Link href="/login" className="btn-primary">
                Get Started
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z" />
                </svg>
              </Link>
              <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="btn-secondary">
                Explore Features
              </button>
            </div>

            {/* Hero Image - Using image.png */}
            <div style={{
              position: 'relative',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 0 60px rgba(79, 70, 229, 0.2)',
              animation: 'fadeIn 0.8s ease 0.4s both',
              border: '1px solid rgba(79, 70, 229, 0.2)',
            }}>
              <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
              }}>
                <Image
                  src="/image.png"
                  alt="ESICodeHub Dashboard"
                  fill
                  style={{
                    objectFit: 'cover',
                  }}
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* TRUSTED BY SECTION */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <section style={{
          paddingTop: '80px',
          paddingBottom: '80px',
          background: '#0a0e27',
          borderTop: '1px solid rgba(148, 163, 184, 0.1)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        }}>
          <div className="container">
            <p style={{
              textAlign: 'center',
              fontSize: '0.75rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#64748b',
              marginBottom: '50px',
              fontWeight: 600,
            }}>
              TRUSTED BY ESI STUDENTS AND FACULTY
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '40px',
              textAlign: 'center',
            }}>
              {[
                { icon: '🏫', label: 'ESI Department' },
                { icon: '🖥️', label: 'CS Labs' },
                { icon: '👨‍💻', label: 'Developer Club' },
                { icon: '🤖', label: 'AI Research Lab' },
              ].map((item) => (
                <div key={item.label} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <span style={{ fontSize: '2.5rem' }}>{item.icon}</span>
                  <span style={{ color: '#94a3b8', fontWeight: 500 }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* FEATURES SECTION */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <section id="features" style={{
          paddingTop: '100px',
          paddingBottom: '100px',
          background: '#0a0e27',
        }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <h2 style={{
                fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
                fontWeight: 700,
                marginBottom: '20px',
                lineHeight: 1.2,
              }}>
                Precision tools for academic excellence.
              </h2>
              <p style={{
                color: '#94a3b8',
                fontSize: '1.05rem',
                maxWidth: '600px',
                margin: '0 auto',
              }}>
                Engineered to streamline the entire coding assignment lifecycle from deployment to grading.
              </p>
            </div>

            {/* Features Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '28px',
            }}>
              {/* Plagiarism Detection */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
                border: '1px solid rgba(79, 70, 229, 0.4)',
                borderRadius: '18px',
                padding: '28px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              }} onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)';
                e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.6)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 16px 32px rgba(79, 70, 229, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)';
                e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.4)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '14px' }}>🔍</div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '10px', fontWeight: 600, color: '#f1f5f9' }}>
                  Plagiarism Intelligence
                </h3>
                <p style={{
                  color: '#94a3b8',
                  fontSize: '0.94rem',
                  lineHeight: 1.65,
                  marginBottom: '24px',
                  flex: 1,
                }}>
                  Our AI-based similarity engine analyzes logic patterns, not just text, ensuring integrity with 98%+ accuracy.
                </p>
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '280px',
                  background: '#0a0e27',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid rgba(79, 70, 229, 0.2)',
                  boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)',
                }}>
                  <Image
                    src="/plagiarism-detection.png"
                    alt="Plagiarism Detection"
                    fill
                    style={{ objectFit: 'contain', padding: '12px' }}
                  />
                </div>
              </div>

              {/* Automation */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
                border: '1px solid rgba(79, 70, 229, 0.4)',
                borderRadius: '18px',
                padding: '28px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              }} onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)';
                e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.6)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 16px 32px rgba(79, 70, 229, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)';
                e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.4)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '14px' }}>⚡</div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '10px', fontWeight: 600, color: '#f1f5f9' }}>
                  Automation
                </h3>
                <p style={{
                  color: '#94a3b8',
                  fontSize: '0.94rem',
                  lineHeight: 1.65,
                  marginBottom: '24px',
                  flex: 1,
                }}>
                  Automated deadline handling, environment setup, and submission packaging for students.
                </p>
                <div style={{
                  background: 'linear-gradient(135deg, #1a1f3a 0%, #0a0e27 100%)',
                  borderRadius: '12px',
                  height: '280px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(79, 70, 229, 0.2)',
                  color: '#94a3b8',
                  fontSize: '0.95rem',
                  flexDirection: 'column',
                  gap: '16px',
                  padding: '20px',
                  textAlign: 'center',
                  boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)',
                }}>
                  <span style={{ fontSize: '3rem' }}>⚙️</span>
                  <span style={{ fontWeight: 500 }}>Streamlined submission workflow</span>
                </div>
              </div>

              {/* Inline Review */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
                border: '1px solid rgba(79, 70, 229, 0.4)',
                borderRadius: '18px',
                padding: '28px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              }} onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)';
                e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.6)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 16px 32px rgba(79, 70, 229, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)';
                e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.4)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '14px' }}>📝</div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '10px', fontWeight: 600, color: '#f1f5f9' }}>
                  Inline Review
                </h3>
                <p style={{
                  color: '#94a3b8',
                  fontSize: '0.94rem',
                  lineHeight: 1.65,
                  marginBottom: '24px',
                  flex: 1,
                }}>
                  Provide meaningful feedback directly on code snippets with automated grading assistants.
                </p>
                <div style={{
                  background: 'linear-gradient(135deg, #1a1f3a 0%, #0a0e27 100%)',
                  borderRadius: '12px',
                  height: '280px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(79, 70, 229, 0.2)',
                  color: '#94a3b8',
                  fontSize: '0.95rem',
                  flexDirection: 'column',
                  gap: '16px',
                  padding: '20px',
                  textAlign: 'center',
                  boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)',
                }}>
                  <span style={{ fontSize: '3rem' }}>💬</span>
                  <span style={{ fontWeight: 500 }}>Real-time code feedback system</span>
                </div>
              </div>

              {/* Professor Dashboards */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
                border: '1px solid rgba(79, 70, 229, 0.4)',
                borderRadius: '18px',
                padding: '28px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              }} onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)';
                e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.6)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 16px 32px rgba(79, 70, 229, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)';
                e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.4)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '14px' }}>📊</div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '10px', fontWeight: 600, color: '#f1f5f9' }}>
                  Professor Dashboards
                </h3>
                <p style={{
                  color: '#94a3b8',
                  fontSize: '0.94rem',
                  lineHeight: 1.65,
                  marginBottom: '24px',
                  flex: 1,
                }}>
                  Real-time analytics on class performance, difficult topics, and submission trends to optimize curriculum.
                </p>
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '280px',
                  background: '#0a0e27',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid rgba(79, 70, 229, 0.2)',
                  boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)',
                }}>
                  <Image
                    src="/analytics-dashboard.png"
                    alt="Analytics Dashboard"
                    fill
                    style={{ objectFit: 'contain', padding: '12px' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* STATS SECTION */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <section style={{
          paddingTop: '80px',
          paddingBottom: '80px',
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0a0e27 100%)',
        }}>
          <div className="container">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '40px',
              textAlign: 'center',
            }}>
              <div>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: 700,
                  color: '#4f46e5',
                  marginBottom: '10px',
                }}>
                  1,200+
                </div>
                <div style={{ color: '#94a3b8', fontSize: '1rem' }}>
                  Active Students
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: 700,
                  color: '#10b981',
                  marginBottom: '10px',
                }}>
                  18k+
                </div>
                <div style={{ color: '#94a3b8', fontSize: '1rem' }}>
                  Submissions
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: 700,
                  color: '#a78bfa',
                  marginBottom: '10px',
                }}>
                  98%
                </div>
                <div style={{ color: '#94a3b8', fontSize: '1rem' }}>
                  Detection Accuracy
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* CTA SECTION */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <section style={{
          paddingTop: '100px',
          paddingBottom: '100px',
          background: '#0a0e27',
          textAlign: 'center',
        }}>
          <div className="container">
            <h2 style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 700,
              marginBottom: '30px',
              lineHeight: 1.2,
            }}>
              Join the ESI academic<br />
              community today.
            </h2>

            <Link href="/login" className="btn-primary" style={{
              display: 'inline-flex',
              padding: '14px 32px',
              fontSize: '1rem',
              marginBottom: '20px',
            }}>
              Get Started with ESI Email @
            </Link>

            <p style={{
              color: '#64748b',
              fontSize: '0.95rem',
            }}>
              Restricted to @esi.dz accounts.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* FOOTER */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <footer style={{
          background: '#050812',
          borderTop: '1px solid rgba(148, 163, 184, 0.1)',
          paddingTop: '60px',
          paddingBottom: '40px',
        }}>
          <div className="container">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '40px',
              marginBottom: '40px',
            }}>
              {/* Brand */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '12px',
                }}>
                  <div style={{ width: '24px', height: '24px', position: 'relative' }}>
                    <Image
                      src="/esicodehub-logo.png"
                      alt="ESICodeHub"
                      fill
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                  <span style={{ fontWeight: 700 }}>EsiCodeHub</span>
                </div>
                <p style={{
                  color: '#64748b',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                }}>
                  The definitive orchestration platform for higher education at ESI. Built for the next-fidelity developer.
                </p>
              </div>

              {/* Product */}
              <div>
                <h4 style={{ fontWeight: 600, marginBottom: '16px', color: '#e2e8f0' }}>
                  Product
                </h4>
                <ul style={{ listStyle: 'none' }}>
                  <li style={{ marginBottom: '10px' }}>
                    <a href="#" onClick={(e) => e.preventDefault()} style={{
                      color: '#94a3b8',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      transition: 'color 0.2s',
                      cursor: 'pointer',
                    }} onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                      Dashboard
                    </a>
                  </li>
                  <li style={{ marginBottom: '10px' }}>
                    <a href="#" onClick={(e) => e.preventDefault()} style={{
                      color: '#94a3b8',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      transition: 'color 0.2s',
                      cursor: 'pointer',
                    }} onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                      Detection
                    </a>
                  </li>
                  <li>
                    <a href="#" onClick={(e) => e.preventDefault()} style={{
                      color: '#94a3b8',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      transition: 'color 0.2s',
                      cursor: 'pointer',
                    }} onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                      API
                    </a>
                  </li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h4 style={{ fontWeight: 600, marginBottom: '16px', color: '#e2e8f0' }}>
                  Company
                </h4>
                <ul style={{ listStyle: 'none' }}>
                  <li style={{ marginBottom: '10px' }}>
                    <a href="#" onClick={(e) => e.preventDefault()} style={{
                      color: '#94a3b8',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      transition: 'color 0.2s',
                      cursor: 'pointer',
                    }} onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                      About ESI
                    </a>
                  </li>
                  <li style={{ marginBottom: '10px' }}>
                    <a href="#" onClick={(e) => e.preventDefault()} style={{
                      color: '#94a3b8',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      transition: 'color 0.2s',
                      cursor: 'pointer',
                    }} onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                      CS Department
                    </a>
                  </li>
                  <li>
                    <a href="#" onClick={(e) => e.preventDefault()} style={{
                      color: '#94a3b8',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      transition: 'color 0.2s',
                      cursor: 'pointer',
                    }} onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                      Contact
                    </a>
                  </li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 style={{ fontWeight: 600, marginBottom: '16px', color: '#e2e8f0' }}>
                  Legal
                </h4>
                <ul style={{ listStyle: 'none' }}>
                  <li style={{ marginBottom: '10px' }}>
                    <a href="#" onClick={(e) => e.preventDefault()} style={{
                      color: '#94a3b8',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      transition: 'color 0.2s',
                      cursor: 'pointer',
                    }} onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                      Privacy Policy
                    </a>
                  </li>
                  <li style={{ marginBottom: '10px' }}>
                    <a href="#" onClick={(e) => e.preventDefault()} style={{
                      color: '#94a3b8',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      transition: 'color 0.2s',
                      cursor: 'pointer',
                    }} onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                      Terms of Service
                    </a>
                  </li>
                  <li>
                    <a href="#" onClick={(e) => e.preventDefault()} style={{
                      color: '#94a3b8',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      transition: 'color 0.2s',
                      cursor: 'pointer',
                    }} onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                      University Terms
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* Copyright */}
            <div style={{
              borderTop: '1px solid rgba(148, 163, 184, 0.1)',
              paddingTop: '30px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.85rem',
            }}>
              © 2026 EsiCodeHub. Built for ESI university. Restricted to @esi.dz accounts.
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
