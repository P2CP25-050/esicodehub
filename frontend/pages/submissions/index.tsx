import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext'; 
import { listSubmissions } from '@/services/submissions/submissions.api';
import type { PersonalSubmission, SubmissionListParams } from '@/services/submissions/submissions.types';
import SearchBar    from '@/components/submissions/SearchBar';
import Filters      from '@/components/submissions/Filters';
import SubmissionsGrid from '@/components/submissions/SubmissionsGrid';
import Header from '@/components/submissions/Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';



export default function SubmissionsPage() {
  const router              = useRouter();
  const { isAuthenticated, isLoading } = useAuth();



  const [submissions, setSubmissions] = useState<PersonalSubmission[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const [search,         setSearch]         = useState('');
  const [language,       setLanguage]       = useState('');

  const [type,           setType]           = useState('');
  const [course,         setCourse]         = useState('');
  const [visibility, setVisibility] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef(search);
  const skipNextSearchDebounceRef = useRef(false);
  const skipInitialSearchEffectRef = useRef(true);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);


  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchSubmissions = useCallback(async (
    params: SubmissionListParams,
    append = false
  ) => {
    try {
      if (!append) setLoading(true);
      else         setLoadingMore(true);
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

    // Filter effect will perform one immediate refetch after reset.
    skipNextSearchDebounceRef.current = true;
    setSearch('');
    setLanguage('');
    setType('');
    setCourse('');
    setVisibility('');
    setPage(1);
  };
  const hasActiveFilter = !!(search || language || type || course || visibility);

  return (
    <ProtectedRoute>

    <>
      <Head>
        <title>Submissions — ESICodeHub</title>
        <meta name="description" content="Browse and explore code shared by ESI students." />

      </Head>

      {/* Keep shimmer keyframe for existing skeleton loaders */}
      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { font-family: 'Outfit', sans-serif; }

        @keyframes riseIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        .submissions-grid-surface h3.text-white {
          color: #0f172a;
        }

        .submissions-grid-surface p.text-gray-400 {
          color: #64748b;
        }
      `}</style>

    <div className="min-h-screen bg-linear-to-b from-white via-slate-50 to-white">
        <Header activePage="Submissions" />

        {/* ════════════════════════════════════════
            CONTENT
        ════════════════════════════════════════ */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

          <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-4 shadow-sm transition-shadow duration-300 hover:shadow-md sm:p-6">

          {/* Search */}
          <div
            className="animate-[riseIn_0.4s_ease_both]"
            style={{ animationDelay: '0ms' }}
          >
            <SearchBar value={search} onChange={setSearch} />
          </div>

          {/* Filters card */}
          <div
            className={`
              mt-5
              bg-white
              rounded-2xl border border-white
              shadow-sm
              p-5
              animate-[riseIn_0.4s_ease_both]
            `}
            style={{ animationDelay: '60ms' }}
          >
            <Filters
              language={language}

              submissionType={type}
              courseTag={course}
	      visibility={visibility}
	      onVisibilityChange={setVisibility}
              onLanguageChange={setLanguage}
              onSubmissionTypeChange={setType}
              onCourseTagChange={setCourse}

              onClear={handleClear}
              hasActiveFilter={hasActiveFilter}
              total={total}
              shown={submissions.length}
              isAuthenticated={isAuthenticated}
              onNewSubmission={() => router.push('/submissions/new')}
            />
          </div>
          </section>

          {/* Error */}
          {error && (
            <div className={`
              flex items-center gap-3 p-4
              bg-rose-50 border border-rose-200 rounded-2xl
              text-red-700 text-sm font-medium
              animate-[riseIn_0.3s_ease_both]
            `}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>
              </svg>
              {error}
              <button

                onClick={() => fetchSubmissions({ ...buildParams(searchRef.current), page: 1 })}

                className="ml-auto underline font-bold"
              >
                Retry
              </button>
            </div>
          )}

          {/* Grid */}
          <div
            className="submissions-grid-surface rounded-3xl border border-slate-200/90 bg-white/95 p-4 shadow-sm animate-[riseIn_0.4s_ease_both] sm:p-6"
            style={{ animationDelay: '120ms' }}
          >
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

        {/* Footer */}
<footer className="mt-16 border-t border-slate-200 bg-white/80 backdrop-blur-sm">
  <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between flex-wrap gap-4">
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold text-slate-500 font-mono">ESICodeHub</span>
    </div>
    <p className="text-xs text-slate-500 font-medium">
      © {new Date().getFullYear()} ESICodeHub · Built for ESI students
    </p>
            <div className="flex items-center gap-4">
              <span
                className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 transition-colors"
                onClick={() => router.push('/')}
              >
                Home
              </span>
              <span
                className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 transition-colors"
                onClick={() => router.push('/submissions')}
              >
                Submissions
              </span>
            </div>
          </div>
        </footer>
      </div>
    </>

    </ProtectedRoute>
  );
}

