import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth'; 
import { listSubmissions } from '@/services/submissions/submissions.api';
import type { PersonalSubmission, SubmissionListParams } from '@/services/submissions/submissions.types';
import SearchBar    from '@/components/submissions/SearchBar';
import Filters      from '@/components/submissions/Filters';
import SubmissionsGrid from '@/components/submissions/SubmissionsGrid';
import { ProtectedRoute } from '@/components/ProtectedRoute';


export default function SubmissionsPage() {
  const router              = useRouter();
  const { isAuthenticated } = useAuth();



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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef(search);
  const skipNextSearchDebounceRef = useRef(false);

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
  }), [language, type, course]);


  

// Dropdown/tag filters → immediate
useEffect(() => {
  setPage(1);
  fetchSubmissions({ ...buildParams(searchRef.current), page: 1 });
}, [language, type, course, fetchSubmissions]); // clean and explicit

// Debounced search
useEffect(() => {
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
}, [search, fetchSubmissions]);




  const handleLoadMore = () => {
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
    setPage(1);
  };
  const hasActiveFilter = !!(search || language || type || course);

  return (
    <ProtectedRoute>
    <>
      <Head>
        <title>Submissions — ESICodeHub</title>
        <meta name="description" content="Browse and explore code shared by ESI students." />

      </Head>

      {/* ── Global styles & keyframes ── */}
      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { font-family: 'Outfit', sans-serif; }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1);   }
          50%       { opacity: .6; transform: scale(0.8); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px);   }
          50%       { transform: translateY(-8px);  }
        }
          
      `}</style>

     <div className="min-h-screen bg-gradient-to-br from-[#0f1f3d] via-[#1a2b4d] to-[#223659]/60">

        {/* ════════════════════════════════════════
            HEADER
        ════════════════════════════════════════ */}
       <header className="relative bg-black/30 backdrop-blur-md border-b border-white/10">
  {/* Animated background grid – keep it but make it more subtle */}
  <div className={`
    absolute inset-0
    bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)]
    bg-[size:48px_48px]
   `}/>

  {/* Radial glow – slightly reduced opacity */}
  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-blue-500/5 blur-3xl rounded-full" />

  {/* Decorative </> – keep as is */}
  <div
    className={`
      absolute right-8 top-1/2 -translate-y-1/2
      text-[7rem] font-black text-white/[0.02]
      font-mono select-none pointer-events-none leading-none
    `}
    style={{ animation: 'float 6s ease-in-out infinite' }}
  >
    &lt;/&gt;
  </div>

  {/* Left accent bar – keep */}
  <div className="absolute left-0 inset-y-0 w-1 bg-gradient-to-b from-blue-400 via-blue-500 to-indigo-600" />

  <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-5">
    {/* Logo, title, auth area – unchanged */}
    <div className="flex items-center justify-between gap-6">
      {/* Logo */}
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => router.push('/')}
      >
        <div className={`
          relative w-10 h-10 rounded-xl overflow-hidden
          ring-2 ring-blue-500/30 group-hover:ring-blue-400/60
          transition-all duration-200
        `}>
          <Image
            src="/logo.png"
            alt="ESICodeHub"
            fill
            className="object-contain"
          />
        </div>
        <span className={`
          hidden sm:block
          text-sm font-bold text-white/70
          group-hover:text-white/90
          transition-colors duration-150
          font-mono
        `}>
          ESICodeHub
        </span>
      </div>

      {/* Page title */}
      <div className="text-center flex-1">
        <h1 className={`
          text-2xl sm:text-3xl font-black text-white
          tracking-tight
        `}>
          Submissions
        </h1>
        <p className="text-blue-300/70 text-xs font-medium mt-0.5 hidden sm:block">
          Browse code shared by ESI students
        </p>
      </div>

      {/* Auth area */}
      <div className="flex items-center gap-3">
        {isAuthenticated && (
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full bg-emerald-400"
              style={{ animation: 'pulse-dot 2s ease infinite' }}
            />
            <button
              onClick={() => router.push('/dashboard')}
              className={`
                text-sm font-semibold text-blue-300
                hover:text-white transition-colors duration-150
              `}
            >
              Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
</header>

        {/* ════════════════════════════════════════
            CONTENT
        ════════════════════════════════════════ */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

          {/* Search */}
          <div
            className="animate-[fadeSlideUp_0.4s_ease_both]"
            style={{ animationDelay: '0ms' }}
          >
            <SearchBar value={search} onChange={setSearch} />
          </div>

          {/* Filters card */}
          <div
            className={`
              bg-white/80 backdrop-blur-sm
              rounded-2xl border border-white
              shadow-sm shadow-blue-100/50
              p-5
              animate-[fadeSlideUp_0.4s_ease_both]
            `}
            style={{ animationDelay: '60ms' }}
          >
            <Filters
              language={language}
              submissionType={type}
              courseTag={course}
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

          {/* Error */}
          {error && (
            <div className={`
              flex items-center gap-3 p-4
              bg-red-50 border border-red-200 rounded-2xl
              text-red-700 text-sm font-medium
              animate-[fadeSlideUp_0.3s_ease_both]
            `}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>
              </svg>
              {error}
              <button
                onClick={() => fetchSubmissions({ page: 1 })}
                className="ml-auto underline font-bold"
              >
                Retry
              </button>
            </div>
          )}

          {/* Grid */}
          <div
            className="animate-[fadeSlideUp_0.4s_ease_both]"
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
        
<footer className="mt-16 border-t border-white/10 bg-black/20 backdrop-blur-sm">
  <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between flex-wrap gap-4">
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold text-white/60 font-mono">ESICodeHub</span>
    </div>
    <p className="text-xs text-white/40 font-medium">
      © {new Date().getFullYear()} ESICodeHub · Built for ESI students
    </p>
            <div className="flex items-center gap-4">
              <span
                className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
                onClick={() => router.push('/')}
              >
                Home
              </span>
              <span
                className="text-xs text-white/40 cursor-pointer hover:text-white/70 transition-colors"
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