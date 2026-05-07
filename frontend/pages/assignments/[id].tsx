import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import axios from 'axios';

import Header from '@/components/submissions/Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import {
  getAssignment,
  getMySubmission,
  getSubmissions,
  submitToAssignment,
  deleteAssignment,
} from '@/services/assignments';
import type { Assignment, AssignmentSubmission } from '@/services/assignments';
import { timeAgo } from '@/utils/time';

// ── CSS ───────────────────────────────────────────────────────────────────────

const PAGE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

  :root {
    --bg:             #0d1117;
    --surface:        #161b22;
    --surface-2:      #21262d;
    --border:         #30363d;
    --accent:         #e6c97a;
    --accent-dim:     rgba(230,201,122,0.12);
    --blue:           #58a6ff;
    --blue-dim:       rgba(88,166,255,0.12);
    --orange:         #f0883e;
    --green:          #3fb950;
    --red:            #f85149;
    --text-primary:   #e6edf3;
    --text-secondary: #8b949e;
    --text-muted:     #484f58;
    --font-display:   'Lora', Georgia, serif;
    --font-mono:      'IBM Plex Mono', monospace;
    --font-body:      'DM Sans', sans-serif;
    --radius:         10px;
    --radius-lg:      16px;
    --shadow:         0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.3);
    --shadow-hover:   0 4px 8px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.4);
  }

  .ad-page {
    min-height: 100vh;
    background: var(--bg);
    font-family: var(--font-body);
    color: var(--text-primary);
    position: relative;
  }
  .ad-page::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none; z-index: 0;
  }

  .ad-main {
    max-width: 1200px; margin: 0 auto;
    padding: 32px 28px 80px;
    position: relative; z-index: 1;
  }

  /* Breadcrumb */
  .ad-breadcrumb {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 28px;
    font-family: var(--font-mono); font-size: 11px;
    letter-spacing: 0.1em; color: var(--text-muted);
  }
  .ad-breadcrumb-link { color: var(--accent); text-decoration: none; transition: opacity 0.15s; }
  .ad-breadcrumb-link:hover { opacity: 0.75; }

  /* Grid */
  .ad-grid { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 20px; }

  /* Cards */
  .ad-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 28px;
    box-shadow: var(--shadow); margin-bottom: 20px;
  }
  .ad-card:last-child { margin-bottom: 0; }

  /* Section label */
  .ad-section-label {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 18px;
  }
  .ad-section-bar {
    width: 3px; height: 18px; border-radius: 2px; flex-shrink: 0;
  }
  .ad-section-text {
    font-family: var(--font-mono); font-size: 10px; font-weight: 600;
    letter-spacing: 0.2em; text-transform: uppercase;
  }

  /* Badge */
  .ad-badge {
    display: inline-flex; align-items: center;
    padding: 3px 10px; border-radius: 6px;
    font-family: var(--font-mono); font-size: 10px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    border: 1px solid transparent;
  }
  .ad-badge-accent  { background: var(--accent-dim); color: var(--accent); border-color: rgba(230,201,122,0.25); }
  .ad-badge-blue    { background: var(--blue-dim); color: var(--blue); border-color: rgba(88,166,255,0.25); }
  .ad-badge-green   { background: rgba(63,185,80,0.12); color: var(--green); border-color: rgba(63,185,80,0.25); }
  .ad-badge-orange  { background: rgba(240,136,62,0.12); color: var(--orange); border-color: rgba(240,136,62,0.25); }
  .ad-badge-red     { background: rgba(248,81,73,0.12); color: var(--red); border-color: rgba(248,81,73,0.3); }
  .ad-badge-muted   { background: var(--surface-2); color: var(--text-secondary); border-color: var(--border); }

  /* Info meta row */
  .ad-meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
  .ad-meta-tile {
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px;
  }
  .ad-meta-label {
    font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;
  }
  .ad-meta-value { font-size: 13px; font-weight: 600; color: var(--text-primary); line-height: 1.4; }
  .ad-meta-sub   { font-size: 11px; color: var(--text-secondary); margin-top: 4px; font-family: var(--font-mono); }

  /* Description box */
  .ad-description {
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px; margin-top: 20px;
    font-size: 13px; line-height: 1.7; color: var(--text-secondary);
  }

  /* File row */
  .ad-file-row {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 12px 16px;
  }
  .ad-file-name { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
  .ad-file-size { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }

  /* Upload zone */
  .ad-upload-zone {
    border: 2px dashed var(--border); border-radius: var(--radius-lg);
    padding: 40px 24px; text-align: center;
    transition: border-color 0.15s, background 0.15s;
    cursor: default;
  }
  .ad-upload-zone.dragover { border-color: var(--blue); background: rgba(88,166,255,0.05); }

  .ad-upload-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 48px; height: 48px; border-radius: 50%;
    background: var(--surface-2); border: 1px solid var(--border);
    color: var(--blue); margin-bottom: 12px;
  }

  /* Buttons */
  .ad-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 18px; border-radius: var(--radius);
    font-family: var(--font-mono); font-size: 11px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    border: none;
  }
  .ad-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
  .ad-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .ad-btn-primary { background: var(--accent); color: #0d1117; box-shadow: 0 4px 14px rgba(230,201,122,0.25); }
  .ad-btn-blue    { background: var(--blue); color: #0d1117; box-shadow: 0 4px 14px rgba(88,166,255,0.25); }
  .ad-btn-ghost   { background: var(--surface-2); color: var(--text-secondary); border: 1px solid var(--border); }
  .ad-btn-danger  { background: rgba(248,81,73,0.12); color: var(--red); border: 1px solid rgba(248,81,73,0.3); }
  .ad-btn-sm { padding: 5px 12px; font-size: 10px; }

  /* Alert banners */
  .ad-alert {
    padding: 12px 16px; border-radius: var(--radius);
    font-size: 13px; font-family: var(--font-body); font-weight: 500;
    border: 1px solid transparent; margin-bottom: 16px;
  }
  .ad-alert-red    { background: rgba(248,81,73,0.1);  border-color: rgba(248,81,73,0.3);  color: var(--red); }
  .ad-alert-green  { background: rgba(63,185,80,0.1);  border-color: rgba(63,185,80,0.3);  color: var(--green); }
  .ad-alert-orange { background: rgba(240,136,62,0.1); border-color: rgba(240,136,62,0.3); color: var(--orange); }

  /* Table */
  .ad-table-wrap { overflow: hidden; border-radius: var(--radius-lg); border: 1px solid var(--border); margin-top: 16px; }
  .ad-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .ad-table thead { background: var(--surface-2); }
  .ad-table th {
    padding: 10px 16px; text-align: left;
    font-family: var(--font-mono); font-size: 10px; font-weight: 600;
    letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-muted);
    border-bottom: 1px solid var(--border);
  }
  .ad-table td { padding: 10px 16px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
  .ad-table tr:last-child td { border-bottom: none; }
  .ad-table tbody tr { transition: background 0.1s; }
  .ad-table tbody tr:hover { background: var(--surface-2); }
  .ad-table-name { font-weight: 600; color: var(--text-primary); }
  .ad-table-muted { color: var(--text-secondary); font-family: var(--font-mono); font-size: 11px; }

  /* Select */
  .ad-select {
    width: 100%; padding: 9px 36px 9px 14px;
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius); color: var(--text-primary);
    font-family: var(--font-body); font-size: 13px;
    outline: none; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b949e' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
    transition: border-color 0.15s;
  }
  .ad-select:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(88,166,255,0.1); }

  /* Review card */
  .ad-review-card {
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 18px; margin-top: 12px;
  }
  .ad-comment-item {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 10px 14px; margin-top: 8px;
  }
  .ad-comment-meta { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
  .ad-comment-text { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }

  /* Toast */
  .ad-toast {
    position: fixed; right: 20px; top: 20px; z-index: 50;
    padding: 14px 18px; border-radius: var(--radius-lg);
    border: 1px solid transparent; box-shadow: var(--shadow-hover);
    animation: ad-toast-in 0.25s ease;
    min-width: 240px; max-width: 340px;
  }
  .ad-toast-success { background: rgba(63,185,80,0.15);  border-color: rgba(63,185,80,0.3);  color: var(--green); }
  .ad-toast-error   { background: rgba(248,81,73,0.15);  border-color: rgba(248,81,73,0.3);  color: var(--red); }
  .ad-toast-info    { background: rgba(88,166,255,0.15); border-color: rgba(88,166,255,0.3); color: var(--blue); }
  .ad-toast-type { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px; }
  .ad-toast-msg  { font-size: 13px; line-height: 1.5; opacity: 0.9; }
  @keyframes ad-toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

  /* Skeleton */
  .ad-skeleton { background: var(--surface-2); border-radius: var(--radius); animation: ad-pulse 1.6s ease-in-out infinite; }
  @keyframes ad-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

  /* Summary info */
  .ad-summary-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-light); font-size: 13px; }
  .ad-summary-item:last-child { border-bottom: none; }
  .ad-summary-label { color: var(--text-secondary); font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
  .ad-summary-value { color: var(--text-primary); font-weight: 600; text-align: right; max-width: 55%; }

  /* File input */
  .ad-file-input {
    width: 100%; cursor: pointer; padding: 10px 14px;
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius); color: var(--text-secondary);
    font-size: 13px; font-family: var(--font-body);
    margin-top: 16px; box-sizing: border-box;
  }

  @media (max-width: 900px)  { .ad-grid { grid-template-columns: 1fr; } .ad-meta-grid { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 600px)  { .ad-main { padding: 20px 14px 60px; } .ad-meta-grid { grid-template-columns: 1fr; } .ad-card { padding: 18px; } }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const formatFileSize = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) return '-';
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const formatPlural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

const getDeadlineBadge = (assignment: Assignment) => {
  const now = new Date();
  const deadline = new Date(assignment.deadline);
  const isPast = now > deadline;
  if (!isPast) return { label: 'Open', cls: 'ad-badge-green' };
  if (isPast && assignment.allow_late) return { label: 'Open (Late)', cls: 'ad-badge-orange' };
  return { label: 'Closed', cls: 'ad-badge-red' };
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (typeof error.message === 'string' && error.message.trim()) return error.message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

const getCountdown = (deadlineValue: string): string => {
  const diff = new Date(deadlineValue).getTime() - Date.now();
  if (Number.isNaN(diff)) return 'Unavailable';
  if (diff <= 0) return `Deadline passed ${timeAgo(deadlineValue)}`;
  const days    = Math.floor(diff / 86_400_000);
  const hours   = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || parts.length > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return `${parts.join(' ')} remaining`;
};

const getSubmissionLineCommentsCount = (submission?: AssignmentSubmission | null): number => {
  if (!submission?.reviews?.length) return 0;
  return submission.reviews.reduce((total, review) => total + (review.comments?.length ?? 0), 0);
};

const getTargetingSummary = (assignment: Assignment): string[] => {
  const parts = [`For ${assignment.target_year} students`];
  if (assignment.target_sections.length > 0) parts.push(`Sections: ${assignment.target_sections.join(', ')}`);
  if (assignment.target_groups.length > 0)   parts.push(`Groups: ${assignment.target_groups.join(', ')}`);
  return parts;
};

const getReviewNotificationStorageKey = (submissionId: number): string => `assignment-review:last-seen:${submissionId}`;

const buildReviewSignature = (submission?: AssignmentSubmission | null): string => {
  if (!submission || !submission.has_reviews) return 'none';
  const reviews = (submission.reviews ?? []).slice().sort((a, b) => a.id - b.id);
  if (reviews.length === 0) return `count:${submission.reviews_count}`;
  return reviews.map((review) => {
    const commentCount = review.comments?.length ?? 0;
    const gradeLabel   = review.grade == null ? 'null' : String(review.grade);
    return `${review.id}:${review.updated_at}:${gradeLabel}:${commentCount}`;
  }).join('|');
};

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="ad-page">
      <Header activePage="Assignments" />
      <main className="ad-main">
        <div className="ad-skeleton" style={{ height: 20, width: 180, marginBottom: 28 }} />
        <div className="ad-grid">
          <div>
            <div className="ad-skeleton" style={{ height: 200, borderRadius: 16, marginBottom: 20 }} />
            <div className="ad-skeleton" style={{ height: 280, borderRadius: 16 }} />
          </div>
          <div>
            <div className="ad-skeleton" style={{ height: 240, borderRadius: 16, marginBottom: 20 }} />
            <div className="ad-skeleton" style={{ height: 140, borderRadius: 16 }} />
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function AssignmentDetailPageContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [assignmentId,       setAssignmentId]       = useState<number | null>(null);
  const [assignment,         setAssignment]         = useState<Assignment | null>(null);
  const [mySubmission,       setMySubmission]       = useState<AssignmentSubmission | null>(null);
  const [submissions,        setSubmissions]        = useState<AssignmentSubmission[]>([]);
  const [selectedGroup,      setSelectedGroup]      = useState<number | undefined>(undefined);
  const [loadingAssignment,  setLoadingAssignment]  = useState(true);
  const [loadingRoleData,    setLoadingRoleData]    = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [initialDataLoaded,  setInitialDataLoaded]  = useState(false);
  const [pageError,          setPageError]          = useState<string | null>(null);
  const [sectionError,       setSectionError]       = useState<string | null>(null);
  const [countdown,          setCountdown]          = useState('');
  const [dragOver,           setDragOver]           = useState(false);
  const [selectedFiles,      setSelectedFiles]      = useState<File[]>([]);
  const [showUploadZone,     setShowUploadZone]     = useState(false);
  const [uploading,          setUploading]          = useState(false);
  const [deleteLoading,      setDeleteLoading]      = useState(false);
  const [toast,              setToast]              = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [fileInputKey,       setFileInputKey]       = useState(0);

  const hasLoadedRoleDataRef          = useRef(false);
  const reviewNotificationReadyRef    = useRef(false);
  const latestReviewSignatureRef      = useRef('none');

  // Inject CSS
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'ad-dark-styles';
    if (!document.getElementById(id)) {
      const tag = document.createElement('style');
      tag.id = id; tag.textContent = PAGE_CSS;
      document.head.appendChild(tag);
    }
  }, []);

  const persistReviewSignature = (submissionId: number, signature: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(getReviewNotificationStorageKey(submissionId), signature);
      window.dispatchEvent(new Event('assignment-review-signature-updated'));
    } catch {}
  };

  const isStudent   = user?.role === 'student';
  const isProfessor = user?.role === 'professor';
  const isCreator   = Boolean(assignment && user && `${user.first_name} ${user.last_name}`.trim() === assignment.professor_name.trim());
  const deadlineBadge   = assignment ? getDeadlineBadge(assignment) : null;
  const canSubmit       = Boolean(assignment?.is_open);
  const hasSubmission   = Boolean(mySubmission);
  const showSubmissionClosed = Boolean(assignment && !assignment.is_open);
  const deadlinePassed  = assignment ? new Date(assignment.deadline).getTime() <= Date.now() : false;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query.id;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setAssignmentId(null); setPageError('Invalid assignment id.');
      setLoadingAssignment(false); setInitialDataLoaded(true); return;
    }
    setAssignmentId(parsed);
  }, [router.isReady, router.query.id]);

  useEffect(() => {
    if (!router.isReady || assignmentId == null || !user) return;
    let cancelled = false;
    const loadAssignment = async () => {
      setLoadingAssignment(true); setPageError(null); setSectionError(null);
      setAssignment(null); setMySubmission(null); setSubmissions([]);
      setSelectedGroup(undefined); setShowUploadZone(false); setSelectedFiles([]);
      setFileInputKey((prev) => prev + 1); setCountdown(''); setInitialDataLoaded(false);
      hasLoadedRoleDataRef.current = false;
      try {
        const assignmentData = await getAssignment(assignmentId);
        if (cancelled) return;
        setAssignment(assignmentData);
      } catch (error: unknown) {
        if (cancelled) return;
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        setPageError(status === 403 ? "You don't have access to this assignment" : getErrorMessage(error, 'Failed to load assignment.'));
        setInitialDataLoaded(true);
      } finally { if (!cancelled) setLoadingAssignment(false); }
    };
    void loadAssignment();
    return () => { cancelled = true; };
  }, [assignmentId, router.isReady, user]);

  useEffect(() => {
    if (!assignment || !user || assignmentId == null) return;
    let cancelled = false;
    const loadRoleData = async () => {
      setLoadingRoleData(true); setSectionError(null);
      try {
        if (isStudent) {
          try {
            const submission = await getMySubmission(assignmentId);
            if (cancelled) return;
            setMySubmission(submission);
          } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              if (!cancelled) setMySubmission(null);
            } else { throw error; }
          }
        } else {
          setLoadingSubmissions(true);
          const response = await getSubmissions(assignmentId, selectedGroup);
          if (cancelled) return;
          setSubmissions(response.results);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        const status  = axios.isAxiosError(error) ? error.response?.status : undefined;
        const message = status === 403 ? "You don't have access to this assignment" : getErrorMessage(error, 'Failed to load assignment data.');
        if (!hasLoadedRoleDataRef.current) setPageError(message);
        else setSectionError(message);
      } finally {
        if (!cancelled) {
          setLoadingRoleData(false); setLoadingSubmissions(false);
          setInitialDataLoaded(true); hasLoadedRoleDataRef.current = true;
        }
      }
    };
    void loadRoleData();
    return () => { cancelled = true; };
  }, [assignment, assignmentId, isStudent, selectedGroup, user]);

  useEffect(() => {
    reviewNotificationReadyRef.current = false;
    latestReviewSignatureRef.current = 'none';
  }, [assignmentId, isStudent]);

  useEffect(() => {
    if (!isStudent || !mySubmission) return;
    const signature = buildReviewSignature(mySubmission);
    latestReviewSignatureRef.current = signature;
    if (typeof window === 'undefined') { reviewNotificationReadyRef.current = true; return; }
    const storageKey = getReviewNotificationStorageKey(mySubmission.id);
    let previousSignature: string | null = null;
    try { previousSignature = window.localStorage.getItem(storageKey); } catch { previousSignature = null; }
    const hasSignatureChange = previousSignature !== signature;
    if (!reviewNotificationReadyRef.current) {
      if (hasSignatureChange) {
        if ((previousSignature === null || previousSignature === 'none') && signature !== 'none')
          setToast({ type: 'info', message: 'Your professor sent a new review on this assignment.' });
        else if (previousSignature && previousSignature !== 'none' && signature !== 'none')
          setToast({ type: 'info', message: 'Your professor updated a previous review on this assignment.' });
      }
      persistReviewSignature(mySubmission.id, signature);
      reviewNotificationReadyRef.current = true;
      return;
    }
    if (!hasSignatureChange) return;
    if (previousSignature === 'none' && signature !== 'none')
      setToast({ type: 'info', message: 'Your professor sent a new review on this assignment.' });
    else if (previousSignature && previousSignature !== 'none' && signature !== 'none')
      setToast({ type: 'info', message: 'Your professor updated a previous review on this assignment.' });
    persistReviewSignature(mySubmission.id, signature);
  }, [isStudent, mySubmission]);

  useEffect(() => {
    if (!isStudent || assignmentId == null || !mySubmission) return;
    let cancelled = false;
    const syncStudentSubmission = async () => {
      try {
        const latestSubmission = await getMySubmission(assignmentId);
        if (cancelled) return;
        const latestSignature = buildReviewSignature(latestSubmission);
        if (latestSignature !== latestReviewSignatureRef.current || latestSubmission.reviews_count !== mySubmission.reviews_count) {
          latestReviewSignatureRef.current = latestSignature;
          setMySubmission(latestSubmission);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (axios.isAxiosError(error) && error.response?.status === 404) setMySubmission(null);
      }
    };
    const interval = window.setInterval(() => { if (!uploading) void syncStudentSubmission(); }, 20000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible' && !uploading) void syncStudentSubmission(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { cancelled = true; window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, [assignmentId, isStudent, mySubmission, uploading]);

  useEffect(() => {
    if (!assignment) return;
    const update = () => setCountdown(getCountdown(assignment.deadline));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [assignment]);

  const reloadStudentSubmission = async () => {
    if (assignmentId == null) return;
    try {
      const submission = await getMySubmission(assignmentId);
      setMySubmission(submission); setShowUploadZone(false);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) { setMySubmission(null); return; }
      throw error;
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    setSelectedFiles((prev) => [...prev, ...Array.from(event.target.files!)]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragOver(false);
    setSelectedFiles((prev) => [...prev, ...Array.from(event.dataTransfer.files)]);
  };

  const removeFile = (index: number) => setSelectedFiles((prev) => prev.filter((_, i) => i !== index));

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!assignmentId || selectedFiles.length === 0) return;
    setUploading(true); setSectionError(null);
    try {
      await submitToAssignment(assignmentId, selectedFiles, selectedFiles.map((f) => f.name));
      await reloadStudentSubmission();
      setSelectedFiles([]); setFileInputKey((prev) => prev + 1);
      setToast({ type: 'success', message: 'Submission uploaded successfully.' });
    } catch (error: unknown) {
      setToast({ type: 'error', message: getErrorMessage(error, 'Failed to upload submission.') });
    } finally { setUploading(false); }
  };

  const handleDeleteAssignment = async () => {
    if (!assignmentId) return;
    if (!window.confirm('Delete this assignment? This cannot be undone.')) return;
    setDeleteLoading(true);
    try { await deleteAssignment(assignmentId); await router.push('/assignments'); }
    catch (error: unknown) {
      setToast({ type: 'error', message: getErrorMessage(error, 'Failed to delete assignment.') });
      setDeleteLoading(false);
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) { router.back(); return; }
    void router.push('/assignments');
  };

  const handleRunPlagiarism = () => {
    if (!assignmentId || !deadlinePassed) return;
    void router.push(`/assignments/${assignmentId}/plagiarism`);
  };

  if (!router.isReady || loadingAssignment || (loadingRoleData && !initialDataLoaded)) {
    return <LoadingSkeleton />;
  }

  if (pageError || !assignment || assignmentId == null) {
    return (
      <div className="ad-page">
        <Header activePage="Assignments" />
        <main className="ad-main">
          <div className="ad-card">
            <button
              type="button"
              onClick={handleBack}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px', borderRadius: 'var(--radius)',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)', marginBottom: '20px',
              }}
            >
              ← Back
            </button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Unable to load assignment
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{pageError ?? 'Unknown error.'}</p>
          </div>
        </main>
      </div>
    );
  }

  const submittedFiles           = mySubmission?.files ?? [];
  const submittedFileLabelById   = new Map<number, string>(submittedFiles.map((f) => [f.id, f.file_path || f.file_name]));
  const lineCommentsCount        = getSubmissionLineCommentsCount(mySubmission);
  const targetSummary            = getTargetingSummary(assignment);
  const groupOptions             = assignment.target_groups.slice().sort((a, b) => a - b);
  const groupLabel               = selectedGroup == null ? 'All groups' : `Group ${selectedGroup}`;
  const showStudentUploadZone    = isStudent && canSubmit && (!hasSubmission || showUploadZone);
  const showSubmittedFiles       = Boolean(mySubmission && submittedFiles.length > 0);
  const showStudentClosedBanner  = isStudent && showSubmissionClosed;
  const showProfessorTable       = isProfessor;

  return (
    <div className="ad-page">
      <Header activePage="Assignments" />

      {/* Toast */}
      {toast && (
        <div className={`ad-toast ad-toast-${toast.type}`}>
          <div className="ad-toast-type">{toast.type === 'success' ? 'Success' : toast.type === 'error' ? 'Error' : 'Notice'}</div>
          <div className="ad-toast-msg">{toast.message}</div>
        </div>
      )}

      <main className="ad-main">
        {/* Breadcrumb */}
        <nav className="ad-breadcrumb">
          <Link href="/" className="ad-breadcrumb-link">~/home</Link>
          <span>/</span>
          <Link href="/assignments" className="ad-breadcrumb-link">assignments</Link>
          <span>/</span>
          <span>detail</span>
        </nav>

        <div className="ad-grid">
          {/* ── Left column ── */}
          <div>
            {/* Header card */}
            <div className="ad-card" style={{ borderTop: '2px solid var(--accent)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    <span className="ad-badge ad-badge-accent">{assignment.subject.code}</span>
                    {deadlineBadge && <span className={`ad-badge ${deadlineBadge.cls}`}>{deadlineBadge.label}</span>}
                  </div>

                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px', lineHeight: 1.25 }}>
                    {assignment.title}
                  </h1>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                    Professor: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{assignment.professor_name}</span>
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', margin: 0 }}>
                    Posted {timeAgo(assignment.created_at)}
                  </p>
                </div>

                {/* Action buttons */}
                {(isProfessor || isCreator) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
                    {isProfessor && (
                      <button
                        type="button"
                        onClick={handleRunPlagiarism}
                        disabled={!deadlinePassed}
                        title={deadlinePassed ? 'Run plagiarism check' : 'Available after the deadline passes.'}
                        className={`ad-btn ${deadlinePassed ? 'ad-btn-ghost' : 'ad-btn-ghost'}`}
                        style={!deadlinePassed ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                      >
                        Plagiarism Check
                      </button>
                    )}
                    {isCreator && (
                      <Link
                        href={`/assignments/${assignment.id}/edit`}
                        style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '8px 18px', borderRadius: 'var(--radius)',
                          background: 'var(--surface-2)', border: '1px solid var(--border)',
                          color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700,
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
                          textTransform: 'uppercase', textDecoration: 'none',
                          transition: 'border-color 0.15s, color 0.15s',
                        }}
                      >
                        Edit
                      </Link>
                    )}
                    {isCreator && (
                      <button
                        type="button"
                        onClick={handleDeleteAssignment}
                        disabled={deleteLoading}
                        className="ad-btn ad-btn-danger"
                      >
                        {deleteLoading ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              {assignment.description && (
                <div className="ad-description">{assignment.description}</div>
              )}

              {/* Meta tiles */}
              <div className="ad-meta-grid">
                <div className="ad-meta-tile">
                  <div className="ad-meta-label">Targeting</div>
                  {targetSummary.map((item) => (
                    <div key={item} className="ad-meta-value" style={{ marginBottom: 2 }}>{item}</div>
                  ))}
                </div>
                <div className="ad-meta-tile">
                  <div className="ad-meta-label">Deadline</div>
                  <div className="ad-meta-value">{formatDateTime(assignment.deadline)}</div>
                  <div className="ad-meta-sub">{countdown}</div>
                </div>
                <div className="ad-meta-tile">
                  <div className="ad-meta-label">Status</div>
                  <div className="ad-meta-value">{assignment.is_open ? 'Open' : 'Closed'}</div>
                  <div className="ad-meta-sub">{assignment.allow_late ? 'Late subs allowed' : 'No late submissions'}</div>
                </div>
              </div>
            </div>

            {/* ── Student submission section ── */}
            {isStudent && (
              <div className="ad-card" style={{ borderTop: '2px solid var(--blue)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                  <div>
                    <div className="ad-section-label" style={{ marginBottom: 4 }}>
                      <div className="ad-section-bar" style={{ background: 'var(--blue)' }} />
                      <span className="ad-section-text" style={{ color: 'var(--blue)' }}>Your Submission</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Submit your code files for this assignment.</p>
                  </div>
                  {hasSubmission && <span className="ad-badge ad-badge-green">Submitted ✓</span>}
                </div>

                {mySubmission && !assignment.is_open && <div className="ad-alert ad-alert-red">Submission closed</div>}
                {mySubmission && assignment.is_open  && <div className="ad-alert ad-alert-green">Submitted successfully</div>}
                {showStudentClosedBanner && !mySubmission && <div className="ad-alert ad-alert-red">Submission closed. You did not submit before the deadline.</div>}

                {/* Submitted files */}
                {mySubmission && (
                  <div style={{ marginTop: 8 }}>
                    {showSubmittedFiles ? (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Submitted files</span>
                          {mySubmission?.is_late && <span className="ad-badge ad-badge-orange">Late submission</span>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {submittedFiles.map((file) => (
                            <div key={file.id} className="ad-file-row">
                              <div>
                                <div className="ad-file-name">{file.file_name}</div>
                                <div className="ad-file-size">{formatFileSize(file.file_size)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="ad-alert" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        Your submission was received, but the file list is not available.
                      </div>
                    )}

                    {assignment.is_open && !showUploadZone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                        <button type="button" onClick={() => setShowUploadZone(true)} className="ad-btn ad-btn-blue">
                          Resubmit
                        </button>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>This will replace your previous submission.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Upload zone */}
                {showStudentUploadZone && (
                  <div style={{ marginTop: 16 }}>
                    {mySubmission && <div className="ad-alert ad-alert-orange" style={{ marginBottom: 16 }}>Resubmitting will replace all previous files.</div>}

                    <form onSubmit={handleUpload}>
                      <div
                        className={`ad-upload-zone${dragOver ? ' dragover' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                      >
                        <div className="ad-upload-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22">
                            <path d="M12 16V4m0 0 4 4m-4-4-4 4M4 16.5A4.5 4.5 0 0 0 8.5 21h7a4.5 4.5 0 0 0 0-9H15" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                          Drop files here or click to browse
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Any file type is accepted.</p>
                        <input key={fileInputKey} type="file" multiple onChange={handleFileInput} className="ad-file-input" />
                      </div>

                      {selectedFiles.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                            Selected files
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {selectedFiles.map((file, index) => (
                              <div key={`${file.name}-${file.lastModified}-${index}`} className="ad-file-row">
                                <div>
                                  <div className="ad-file-name">{file.name}</div>
                                  <div className="ad-file-size">{formatFileSize(file.size)}</div>
                                </div>
                                <button type="button" onClick={() => removeFile(index)} className="ad-btn ad-btn-ghost ad-btn-sm">
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                        <button
                          type="button"
                          onClick={() => { setSelectedFiles([]); setFileInputKey((prev) => prev + 1); }}
                          className="ad-btn ad-btn-ghost"
                          disabled={uploading}
                        >
                          Clear
                        </button>
                        <button
                          type="submit"
                          disabled={uploading || selectedFiles.length === 0}
                          className="ad-btn ad-btn-blue"
                        >
                          {uploading ? 'Uploading…' : 'Submit Assignment'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {!mySubmission && !assignment.is_open && (
                  <div className="ad-alert ad-alert-red" style={{ marginTop: 16 }}>You did not submit before the deadline.</div>
                )}

                {/* Reviews */}
                {mySubmission?.has_reviews && (
                  <div style={{ marginTop: 28 }}>
                    <div className="ad-section-label">
                      <div className="ad-section-bar" style={{ background: 'var(--accent)' }} />
                      <span className="ad-section-text" style={{ color: 'var(--accent)' }}>Your Reviews</span>
                    </div>

                    {mySubmission.reviews?.map((review) => {
                      const gradeLabel    = review.grade == null ? 'No grade' : `${review.grade}/20`;
                      const commentsCount = review.comments?.length ?? 0;
                      return (
                        <div key={review.id} className="ad-review-card">
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{review.professor_name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{commentsCount} line comments</div>
                            </div>
                            <span className="ad-badge ad-badge-accent">{gradeLabel}</span>
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 12px' }}>
                            {review.general_comment || 'No general comment provided.'}
                          </p>

                          {commentsCount > 0 ? (
                            <>
                              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                                Line Comments
                              </div>
                              {review.comments?.map((comment) => (
                                <div key={comment.id} className="ad-comment-item">
                                  <div className="ad-comment-meta">
                                    {submittedFileLabelById.get(comment.file) ?? `File #${comment.file}`} · Line {comment.line_number}
                                  </div>
                                  <div className="ad-comment-text">{comment.content}</div>
                                </div>
                              ))}
                            </>
                          ) : (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No line comments on this review.</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <aside>
            {/* Professor: submissions table */}
            {showProfessorTable ? (
              <>
                <div className="ad-card" style={{ borderTop: '2px solid var(--blue)' }}>
                  <div className="ad-section-label">
                    <div className="ad-section-bar" style={{ background: 'var(--blue)' }} />
                    <span className="ad-section-text" style={{ color: 'var(--blue)' }}>
                      Submissions ({assignment.submission_count})
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                    Review student submissions for this assignment.
                  </p>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                      Group Filter
                    </div>
                    <select
                      className="ad-select"
                      value={selectedGroup ?? ''}
                      onChange={(e) => setSelectedGroup(e.target.value ? Number(e.target.value) : undefined)}
                    >
                      <option value="">All groups</option>
                      {groupOptions.map((g) => <option key={g} value={g}>Group {g}</option>)}
                    </select>
                  </div>

                  {sectionError && <div className="ad-alert ad-alert-red">{sectionError}</div>}

                  {loadingSubmissions || loadingRoleData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      {[1,2,3].map((i) => <div key={i} className="ad-skeleton" style={{ height: 44 }} />)}
                    </div>
                  ) : submissions.length === 0 ? (
                    <div className="ad-alert" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      No submissions yet
                    </div>
                  ) : (
                    <div className="ad-table-wrap">
                      <table className="ad-table">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Submitted</th>
                            <th>Files</th>
                            <th>Reviews</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissions.map((sub) => (
                            <tr key={sub.id}>
                              <td>
                                <span className="ad-table-name">{sub.student_name}</span>
                                {sub.is_late && <span className="ad-badge ad-badge-orange" style={{ marginLeft: 6, fontSize: '9px' }}>Late</span>}
                              </td>
                              <td className="ad-table-muted">{formatDateTime(sub.submitted_at)}</td>
                              <td className="ad-table-muted">{formatPlural(sub.file_count, 'file')}</td>
                              <td className="ad-table-muted">{sub.reviews_count}</td>
                              <td>
                                <Link
                                  href={`/assignments/${assignment.id}/submissions/${sub.id}`}
                                  style={{
                                    display: 'inline-block',
                                    padding: '5px 12px', borderRadius: 'var(--radius)',
                                    background: 'var(--blue)', color: '#0d1117',
                                    fontSize: '10px', fontWeight: 700,
                                    fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                                    textDecoration: 'none', whiteSpace: 'nowrap',
                                    transition: 'opacity 0.15s',
                                  }}
                                >
                                  Review
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Assignment summary */}
                <div className="ad-card" style={{ borderTop: '2px solid var(--accent)' }}>
                  <div className="ad-section-label">
                    <div className="ad-section-bar" style={{ background: 'var(--accent)' }} />
                    <span className="ad-section-text" style={{ color: 'var(--accent)' }}>Summary</span>
                  </div>
                  {[
                    { label: 'Subject',    value: assignment.subject.name },
                    { label: 'Deadline',   value: formatDateTime(assignment.deadline) },
                    { label: 'Visibility', value: assignment.is_open ? 'Open' : 'Closed' },
                    { label: 'Filter',     value: groupLabel },
                  ].map(({ label, value }) => (
                    <div key={label} className="ad-summary-item">
                      <span className="ad-summary-label">{label}</span>
                      <span className="ad-summary-value">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {sectionError && (
                  <div className="ad-card">
                    <div className="ad-alert ad-alert-red">{sectionError}</div>
                  </div>
                )}

                {/* Quick facts for students */}
                <div className="ad-card" style={{ borderTop: '2px solid var(--accent)' }}>
                  <div className="ad-section-label">
                    <div className="ad-section-bar" style={{ background: 'var(--accent)' }} />
                    <span className="ad-section-text" style={{ color: 'var(--accent)' }}>Quick Facts</span>
                  </div>
                  {[
                    { label: 'Submitted Files', value: String(submittedFiles.length) },
                    { label: 'Line Comments',   value: String(lineCommentsCount) },
                    { label: 'Status',          value: assignment.is_open ? 'Open' : 'Closed' },
                  ].map(({ label, value }) => (
                    <div key={label} className="ad-summary-item">
                      <span className="ad-summary-label">{label}</span>
                      <span className="ad-summary-value">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

export default function AssignmentDetailPage() {
  return (
    <ProtectedRoute>
      <AssignmentDetailPageContent />
    </ProtectedRoute>
  );
}