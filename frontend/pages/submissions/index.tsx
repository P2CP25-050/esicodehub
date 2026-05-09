import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { listSubmissions } from '@/services/submissions/submissions.api';
import type { PersonalSubmission, SubmissionListParams } from '@/services/submissions/submissions.types';
import SearchBar from '@/components/submissions/SearchBar';
import Filters from '@/components/submissions/Filters';
import SubmissionsGrid from '@/components/submissions/SubmissionsGrid';
import Header from '@/components/submissions/Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function SubmissionsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const [submissions, setSubmissions] = useState<PersonalSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search,         setSearch]         = useState('');
  const [language,       setLanguage]       = useState('');

  const [type,           setType]           = useState('');
  const [course,         setCourse]         = useState('');
  const [visibility, setVisibility] = useState<SubmissionListParams['visibility'] | ''>('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef(search);
  const skipNextSearchDebounceRef = useRef(false);
  const skipInitialSearchEffectRef = useRef(true);

  useEffect(() => { searchRef.current = search; }, [search]);

  const fetchSubmissions = useCallback(async (params: SubmissionListParams, append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      const data = await listSubmissions({ ...params, page: params.page ?? 1 });
      setTotal(data.count);
      setHasMore(!!data.next);
      setSubmissions(prev => append ? [...prev, ...data.results] : data.results);
    } catch {
      setError('Failed to load submissions. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const buildParams = useCallback((searchValue: string): SubmissionListParams => ({
    language: language || undefined,
    type: type || undefined,
    course: course || undefined,
    search: searchValue || undefined,
    visibility: visibility || undefined,
  }), [language, type, course, visibility]);


  

// Dropdown/tag filters → immediate
useEffect(() => {
  if (isLoading || !isAuthenticated) return;
  setPage(1);
  fetchSubmissions({ ...buildParams(searchRef.current), page: 1 });
}, [isAuthenticated, isLoading, language, type, course, visibility, buildParams, fetchSubmissions]); 

  // Debounced search
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (skipInitialSearchEffectRef.current) {
      skipInitialSearchEffectRef.current = false;
      return;
    }
    if (skipNextSearchDebounceRef.current) {
      skipNextSearchDebounceRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchSubmissions({ ...buildParams(search), page: 1 });
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [isAuthenticated, isLoading, search, buildParams, fetchSubmissions]);

  const handleLoadMore = () => {
    if (!isAuthenticated) return;
    const next = page + 1;
    setPage(next);
    fetchSubmissions({ ...buildParams(searchRef.current), page: next }, true);
  };

  const handleClear = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    skipNextSearchDebounceRef.current = true;
    setSearch('');
    setLanguage('');
    setType('');
    setCourse('');
    setVisibility('');
    setPage(1);
  };
  const hasActiveFilter = !!(search || language || type || course || visibility);

  // Style injection (same design system as new.tsx)
  useEffect(() => {
    if (typeof document !== "undefined") {
      const styleId = "es-list-styles";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
          :root {
            --ink: #000000;
            --paper: #ffffff;
            --navy: #051650;
            --rule: 1.5px solid #000;
            --font-display: 'Playfair Display', Georgia, serif;
            --font-mono: 'Space Mono', monospace;
            --font-body: 'DM Sans', sans-serif;
          }
          .es-page {
            min-height: 100vh;
            background: var(--paper);
            font-family: var(--font-body);
            color: var(--ink);
            position: relative;
          }
          .es-page::before {
            content: '';
            position: fixed;
            top: 0;
            right: 0;
            width: 340px;
            height: 100vh;
            background: var(--navy);
            clip-path: polygon(60px 0, 100% 0, 100% 100%, 0 100%);
            z-index: 0;
            pointer-events: none;
          }
          .es-container {
            max-width: 1180px;
            margin: 0 auto;
            padding: 40px 28px 80px;
            position: relative;
            z-index: 1;
          }
          .es-card {
            background: var(--paper);
            border: var(--rule);
            border-top: 4px solid var(--navy);
            padding: 24px;
            position: relative;
          }
          .es-card::after {
            content: '';
            position: absolute;
            bottom: -1px;
            right: -1px;
            width: 24px;
            height: 24px;
            border-bottom: 4px solid var(--navy);
            border-right: 4px solid var(--navy);
          }
          @keyframes riseIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @media (max-width: 900px) {
            .es-page::before { display: none; }
            .es-card { padding: 16px; }
            .es-container { padding: 20px 16px; }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <ProtectedRoute>
      <>
        <Head>
          <title>Submissions — ESICodeHub</title>
          <meta name="description" content="Browse and explore code shared by ESI students." />
        </Head>
        <div className="es-page">
          <Header activePage="Submissions" />
          <main className="es-container space-y-5">
            <div className="es-card animate-[riseIn_0.4s_ease_both] p-4 sm:p-6">
              <div className="animate-[riseIn_0.4s_ease_both]" style={{ animationDelay: '0ms' }}>
                <SearchBar value={search} onChange={setSearch} />
              </div>
              <div className="mt-5 animate-[riseIn_0.4s_ease_both]" style={{ animationDelay: '60ms' }}>
                <Filters
                  language={language}
                  submissionType={type}
                  courseTag={course}
                  onLanguageChange={setLanguage}
                  onSubmissionTypeChange={setType}
                  onCourseTagChange={setCourse}
                  visibility={visibility}
	                onVisibilityChange={setVisibility}
                  onClear={handleClear}
                  hasActiveFilter={hasActiveFilter}
                  total={total}
                  shown={submissions.length}
                  isAuthenticated={isAuthenticated}
                  onNewSubmission={() => router.push('/submissions/new')}
                />
              </div>
            </div>

            {error && (
              <div className="es-card border-red-200! bg-red-50! flex items-center gap-3 animate-[riseIn_0.3s_ease_both]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 text-red-700">
                  <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
                </svg>
                <span className="text-red-700 text-sm font-medium">{error}</span>
                <button onClick={() => fetchSubmissions({ ...buildParams(searchRef.current), page: 1 })} className="ml-auto underline font-bold text-red-800">
                  Retry
                </button>
              </div>
            )}

            <div className="es-card animate-[riseIn_0.4s_ease_both] p-4 sm:p-6" style={{ animationDelay: '120ms' }}>
              <SubmissionsGrid
                submissions={submissions}
                loading={loading}
                loadingMore={loadingMore}
                hasMore={hasMore}
                hasFilters={hasActiveFilter}
                isAuthenticated={isAuthenticated}
                onLoadMore={handleLoadMore}
                onNew={() => router.push('/submissions/new')}
              />
            </div>
          </main>

          <footer className="mt-16 border-t border-black/10 bg-white/80 backdrop-blur-sm">
            <div className="es-container py-6! flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-mono text-black/60">ESICodeHub</span>
              </div>
              <p className="text-xs text-black/50 font-medium">© {new Date().getFullYear()} ESICodeHub · Built for ESI students</p>
              <div className="flex gap-4">
                <span className="text-xs text-black/50 cursor-pointer hover:text-black transition-colors" onClick={() => router.push('/')}>Home</span>
                <span className="text-xs text-black/50 cursor-pointer hover:text-black transition-colors" onClick={() => router.push('/submissions')}>Submissions</span>
              </div>
            </div>
          </footer>
        </div>
      </>
    </ProtectedRoute>
  );
}
