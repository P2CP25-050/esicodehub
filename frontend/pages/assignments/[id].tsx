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

// ── Ink & Paper CSS (consistent with index.tsx) ─────────────────────────────

const PAGE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --ink:          #000000;
    --paper:        #ffffff;
    --navy:         #051650;
    --rule:         1.5px solid #000;
    --surface:      #f7f7f5;
    --surface-2:    #f0efec;
    --border-soft:  #e0e0e0;
    --text-sub:     #444444;
    --text-muted:   #666666;
    --red:          #cc0000;
    --green:        #1a7a3c;
    --orange:       #b85c00;
    --blue:         #1a4fa8;
    --font-display: 'Playfair Display', Georgia, serif;
    --font-mono:    'Space Mono', monospace;
    --font-body:    'DM Sans', sans-serif;
    --radius:       0px;
    --radius-lg:    0px;
    --shadow:       none;
    --shadow-hover: none;
  }

  .ap-page {
    min-height: 100vh;
    background: var(--paper);
    font-family: var(--font-body);
    color: var(--ink);
    position: relative;
  }
  .ap-page::before {
    content: '';
    position: fixed;
    top: 0; right: 0;
    width: 280px;
    height: 100vh;
    background: var(--navy);
    clip-path: polygon(80px 0, 100% 0, 100% 100%, 0 100%);
    z-index: 0;
    pointer-events: none;
  }

  .ap-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 28px 80px;
    position: relative;
    z-index: 1;
  }

  .ap-breadcrumb {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 36px;
    font-family: var(--font-mono); font-size: 10px;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted);
  }
  .ap-breadcrumb-link {
    color: var(--navy); font-weight: 700; text-decoration: none;
    border-bottom: 1.5px solid var(--navy); padding-bottom: 1px;
    transition: opacity 0.15s;
  }
  .ap-breadcrumb-link:hover { opacity: 0.65; }
  .ap-breadcrumb-sep { color: #aaa; }

  .ap-page-header {
    display: flex; flex-wrap: wrap;
    align-items: flex-end; justify-content: space-between;
    gap: 16px; padding-bottom: 28px;
    border-bottom: var(--rule); margin-bottom: 28px;
  }
  .ap-page-title {
    font-family: var(--font-display); font-size: 40px;
    font-weight: 900; color: var(--ink);
    margin: 0 0 6px; line-height: 1.05; letter-spacing: -0.02em;
  }
  .ap-page-title span { color: var(--navy); }
  .ap-page-subtitle {
    font-family: var(--font-mono); font-size: 9.5px;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--text-muted); font-weight: 700; margin: 0;
  }

  .ap-card {
    background: var(--surface);
    border: var(--rule);
    padding: 24px;
    margin-bottom: 24px;
  }
  .ap-card:last-child { margin-bottom: 0; }

  .ap-section-label {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 16px;
  }
  .ap-section-bar {
    width: 3px; height: 20px;
    background: var(--navy);
  }
  .ap-section-text {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--text-sub);
  }

  .ap-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border: var(--rule);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: var(--paper);
  }
  .ap-badge-green {
    border-color: var(--green);
    color: var(--green);
  }
  .ap-badge-orange {
    border-color: var(--orange);
    color: var(--orange);
  }
  .ap-badge-red {
    border-color: var(--red);
    color: var(--red);
  }
  .ap-badge-blue {
    border-color: var(--blue);
    color: var(--blue);
  }
  .ap-badge-accent {
    border-color: var(--navy);
    color: var(--navy);
  }

  .ap-meta-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-top: 24px;
  }
  .ap-meta-tile {
    background: var(--paper);
    border: var(--rule);
    padding: 16px;
  }
  .ap-meta-label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .ap-meta-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.4;
  }
  .ap-meta-sub {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
    font-family: var(--font-mono);
  }

  .ap-description {
    background: var(--paper);
    border: var(--rule);
    padding: 16px;
    margin-top: 20px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-sub);
  }

  .ap-file-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--paper);
    border: var(--rule);
    padding: 12px 16px;
  }
  .ap-file-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
  }
  .ap-file-size {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .ap-upload-zone {
    border: 2px dashed var(--border-soft);
    padding: 40px 24px;
    text-align: center;
    transition: border-color 0.15s, background 0.15s;
  }
  .ap-upload-zone.dragover {
    border-color: var(--blue);
    background: rgba(26, 79, 168, 0.05);
  }
  .ap-upload-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--surface-2);
    border: var(--rule);
    color: var(--blue);
    margin-bottom: 12px;
  }

  .ap-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border: var(--rule);
    background: var(--paper);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: box-shadow 0.12s, transform 0.1s;
  }
  .ap-btn:hover:not(:disabled) {
    box-shadow: 4px 4px 0 var(--ink);
    transform: translate(-2px, -2px);
  }
  .ap-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .ap-btn-primary {
    background: var(--navy);
    border-color: var(--navy);
    color: var(--paper);
  }
  .ap-btn-primary:hover:not(:disabled) {
    box-shadow: 4px 4px 0 var(--navy);
    background: var(--ink);
  }
  .ap-btn-danger {
    border-color: var(--red);
    color: var(--red);
    background: transparent;
  }
  .ap-btn-sm {
    padding: 4px 12px;
    font-size: 10px;
  }

  .ap-alert {
    padding: 12px 16px;
    border: var(--rule);
    font-size: 13px;
    margin-bottom: 16px;
  }
  .ap-alert-red {
    background: rgba(204, 0, 0, 0.05);
    border-color: var(--red);
    color: var(--red);
  }
  .ap-alert-green {
    background: rgba(26, 122, 60, 0.05);
    border-color: var(--green);
    color: var(--green);
  }
  .ap-alert-orange {
    background: rgba(184, 92, 0, 0.05);
    border-color: var(--orange);
    color: var(--orange);
  }

  .ap-table-wrapper {
    overflow-x: auto;
    border: var(--rule);
    margin-top: 16px;
  }
  .ap-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .ap-table th {
    padding: 12px 16px;
    text-align: left;
    background: var(--surface-2);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--text-muted);
    border-bottom: var(--rule);
  }
  .ap-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-soft);
    vertical-align: middle;
  }
  .ap-table tr:last-child td {
    border-bottom: none;
  }

  .ap-select {
    width: 100%;
    padding: 9px 36px 9px 14px;
    background: var(--paper);
    border: var(--rule);
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23000' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    cursor: pointer;
  }
  .ap-select:focus {
    box-shadow: 3px 3px 0 var(--navy);
    border-color: var(--navy);
    outline: none;
  }

  .ap-review-card {
    background: var(--paper);
    border: var(--rule);
    padding: 20px;
    margin-top: 16px;
  }
  .ap-comment-item {
    background: var(--surface);
    border: var(--rule);
    padding: 12px;
    margin-top: 12px;
  }
  .ap-comment-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .ap-comment-text {
    font-size: 13px;
    color: var(--text-sub);
    line-height: 1.6;
  }

  .ap-summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-soft);
  }
  .ap-summary-item:last-child {
    border-bottom: none;
  }
  .ap-summary-label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .ap-summary-value {
    font-weight: 600;
    text-align: right;
    max-width: 55%;
  }

  .ap-toast {
    position: fixed;
    right: 20px;
    top: 20px;
    z-index: 50;
    padding: 14px 20px;
    background: var(--paper);
    border: var(--rule);
    box-shadow: 4px 4px 0 var(--ink);
    animation: ap-toast-in 0.2s ease;
    max-width: 320px;
  }
  .ap-toast-success {
    border-left: 4px solid var(--green);
  }
  .ap-toast-error {
    border-left: 4px solid var(--red);
  }
  .ap-toast-info {
    border-left: 4px solid var(--blue);
  }
  .ap-toast-type {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .ap-toast-msg {
    font-size: 13px;
  }
  @keyframes ap-toast-in {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .ap-skeleton {
    background: var(--surface-2);
    border: var(--rule);
    animation: ap-pulse 1.6s ease-in-out infinite;
  }
  @keyframes ap-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .ap-file-input {
    width: 100%;
    margin-top: 16px;
    padding: 10px;
    border: var(--rule);
    background: var(--paper);
    font-size: 13px;
    cursor: pointer;
  }

  .ap-layout-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 24px;
  }

  @media (max-width: 960px) {
    .ap-layout-grid { grid-template-columns: 1fr; }
    .ap-meta-grid { grid-template-columns: 1fr 1fr; }
    .ap-page-title { font-size: 30px; }
    .ap-page::before { display: none; }
    .ap-container { padding: 24px 16px 60px; }
  }
  @media (max-width: 620px) {
    .ap-meta-grid { grid-template-columns: 1fr; }
    .ap-page-title { font-size: 24px; }
  }
`;

// ── Helpers (unchanged logic) ───────────────────────────────────────────────

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
  if (!isPast) return { label: 'Open', cls: 'ap-badge-green' };
  if (isPast && assignment.allow_late) return { label: 'Open (Late)', cls: 'ap-badge-orange' };
  return { label: 'Closed', cls: 'ap-badge-red' };
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

// ── Loading skeleton (adapted) ───────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="ap-page">
      <Header activePage="Assignments" />
      <div className="ap-container">
        <div className="ap-skeleton" style={{ height: 20, width: 180, marginBottom: 28 }} />
        <div className="ap-layout-grid">
          <div>
            <div className="ap-skeleton" style={{ height: 220, marginBottom: 24 }} />
            <div className="ap-skeleton" style={{ height: 300 }} />
          </div>
          <div>
            <div className="ap-skeleton" style={{ height: 240, marginBottom: 24 }} />
            <div className="ap-skeleton" style={{ height: 160 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

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
    const id = 'ap-assignment-detail-styles';
    if (!document.getElementById(id)) {
      const tag = document.createElement('style');
      tag.id = id;
      tag.textContent = PAGE_CSS;
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
      <div className="ap-page">
        <Header activePage="Assignments" />
        <div className="ap-container">
          <button
            type="button"
            onClick={handleBack}
            className="ap-btn ap-btn-primary"
            style={{ marginBottom: '24px' }}
          >
            ← Back
          </button>
          <div className="ap-card">
            <h1 className="ap-page-title" style={{ fontSize: '24px', marginBottom: '8px' }}>Unable to load assignment</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{pageError ?? 'Unknown error.'}</p>
          </div>
        </div>
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
    <div className="ap-page">
      <Header activePage="Assignments" />

      {toast && (
        <div className={`ap-toast ap-toast-${toast.type}`}>
          <div className="ap-toast-type">{toast.type === 'success' ? 'Success' : toast.type === 'error' ? 'Error' : 'Notice'}</div>
          <div className="ap-toast-msg">{toast.message}</div>
        </div>
      )}

      <div className="ap-container">
        <nav className="ap-breadcrumb">
          <Link href="/" className="ap-breadcrumb-link">~/home</Link>
          <span className="ap-breadcrumb-sep">/</span>
          <Link href="/assignments" className="ap-breadcrumb-link">assignments</Link>
          <span className="ap-breadcrumb-sep">/</span>
          <span>detail</span>
        </nav>

        <div className="ap-layout-grid">
          {/* ── Left column ── */}
          <div>
            {/* Header card */}
            <div className="ap-card" style={{ borderTop: `2px solid var(--navy)` }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <span className="ap-badge ap-badge-accent">{assignment.subject.code}</span>
                    {deadlineBadge && <span className={`ap-badge ${deadlineBadge.cls}`}>{deadlineBadge.label}</span>}
                  </div>
                  <h1 className="ap-page-title" style={{ marginBottom: '8px', fontSize: '28px' }}>{assignment.title}</h1>
                  <p style={{ fontSize: '13px', color: 'var(--text-sub)', marginBottom: '4px' }}>
                    Professor: <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{assignment.professor_name}</span>
                  </p>
                  <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    Posted {timeAgo(assignment.created_at)}
                  </p>
                </div>

                {(isProfessor || isCreator) && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {isProfessor && (
                      <button
                        type="button"
                        onClick={handleRunPlagiarism}
                        disabled={!deadlinePassed}
                        title={deadlinePassed ? 'Run plagiarism check' : 'Available after the deadline passes.'}
                        className="ap-btn"
                        style={!deadlinePassed ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                      >
                        Plagiarism Check
                      </button>
                    )}
                    {isCreator && (
                      <Link href={`/assignments/${assignment.id}/edit`} className="ap-btn">
                        Edit
                      </Link>
                    )}
                    {isCreator && (
                      <button type="button" onClick={handleDeleteAssignment} disabled={deleteLoading} className="ap-btn ap-btn-danger">
                        {deleteLoading ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {assignment.description && (
                <div className="ap-description">{assignment.description}</div>
              )}

              <div className="ap-meta-grid">
                <div className="ap-meta-tile">
                  <div className="ap-meta-label">Targeting</div>
                  {targetSummary.map((item) => (
                    <div key={item} className="ap-meta-value" style={{ marginBottom: 2 }}>{item}</div>
                  ))}
                </div>
                <div className="ap-meta-tile">
                  <div className="ap-meta-label">Deadline</div>
                  <div className="ap-meta-value">{formatDateTime(assignment.deadline)}</div>
                  <div className="ap-meta-sub">{countdown}</div>
                </div>
                <div className="ap-meta-tile">
                  <div className="ap-meta-label">Status</div>
                  <div className="ap-meta-value">{assignment.is_open ? 'Open' : 'Closed'}</div>
                  <div className="ap-meta-sub">{assignment.allow_late ? 'Late subs allowed' : 'No late submissions'}</div>
                </div>
              </div>
            </div>

            {/* Student submission section */}
            {isStudent && (
              <div className="ap-card" style={{ borderTop: `2px solid var(--blue)` }}>
                <div className="ap-section-label">
                  <div className="ap-section-bar" style={{ background: 'var(--blue)' }} />
                  <span className="ap-section-text" style={{ color: 'var(--blue)' }}>Your Submission</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-sub)', marginBottom: hasSubmission ? '12px' : '20px' }}>
                  Submit your code files for this assignment.
                </p>

                {mySubmission && !assignment.is_open && <div className="ap-alert ap-alert-red">Submission closed</div>}
                {mySubmission && assignment.is_open  && <div className="ap-alert ap-alert-green">Submitted successfully</div>}
                {showStudentClosedBanner && !mySubmission && <div className="ap-alert ap-alert-red">Submission closed. You did not submit before the deadline.</div>}

                {mySubmission && (
                  <div>
                    {showSubmittedFiles ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span style={{ fontWeight: 600 }}>Submitted files</span>
                          {mySubmission?.is_late && <span className="ap-badge ap-badge-orange">Late submission</span>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {submittedFiles.map((file) => (
                            <div key={file.id} className="ap-file-row">
                              <div>
                                <div className="ap-file-name">{file.file_name}</div>
                                <div className="ap-file-size">{formatFileSize(file.file_size)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="ap-alert" style={{ background: 'var(--surface-2)', border: 'var(--rule)', color: 'var(--text-muted)' }}>
                        Your submission was received, but the file list is not available.
                      </div>
                    )}

                    {assignment.is_open && !showUploadZone && (
                      <div style={{ marginTop: '20px' }}>
                        <button type="button" onClick={() => setShowUploadZone(true)} className="ap-btn ap-btn-primary">
                          Resubmit
                        </button>
                        <span style={{ fontSize: '11px', marginLeft: '10px', color: 'var(--text-muted)' }}>This will replace your previous submission.</span>
                      </div>
                    )}
                  </div>
                )}

                {showStudentUploadZone && (
                  <div style={{ marginTop: '20px' }}>
                    {mySubmission && <div className="ap-alert ap-alert-orange">Resubmitting will replace all previous files.</div>}
                    <form onSubmit={handleUpload}>
                      <div
                        className={`ap-upload-zone${dragOver ? ' dragover' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                      >
                        <div className="ap-upload-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22">
                            <path d="M12 16V4m0 0 4 4m-4-4-4 4M4 16.5A4.5 4.5 0 0 0 8.5 21h7a4.5 4.5 0 0 0 0-9H15" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <p style={{ fontWeight: 600, marginBottom: '4px' }}>Drop files here or click to browse</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Any file type is accepted.</p>
                        <input key={fileInputKey} type="file" multiple onChange={handleFileInput} className="ap-file-input" />
                      </div>

                      {selectedFiles.length > 0 && (
                        <div style={{ marginTop: '16px' }}>
                          <div style={{ fontWeight: 600, marginBottom: '8px' }}>Selected files</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {selectedFiles.map((file, index) => (
                              <div key={`${file.name}-${file.lastModified}-${index}`} className="ap-file-row">
                                <div>
                                  <div className="ap-file-name">{file.name}</div>
                                  <div className="ap-file-size">{formatFileSize(file.size)}</div>
                                </div>
                                <button type="button" onClick={() => removeFile(index)} className="ap-btn ap-btn-sm">
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                        <button
                          type="button"
                          onClick={() => { setSelectedFiles([]); setFileInputKey((prev) => prev + 1); }}
                          className="ap-btn"
                          disabled={uploading}
                        >
                          Clear
                        </button>
                        <button
                          type="submit"
                          disabled={uploading || selectedFiles.length === 0}
                          className="ap-btn ap-btn-primary"
                        >
                          {uploading ? 'Uploading…' : 'Submit Assignment'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {!mySubmission && !assignment.is_open && (
                  <div className="ap-alert ap-alert-red" style={{ marginTop: '16px' }}>You did not submit before the deadline.</div>
                )}

                {/* Reviews */}
                {mySubmission?.has_reviews && (
                  <div style={{ marginTop: '24px' }}>
                    <div className="ap-section-label">
                      <div className="ap-section-bar" style={{ background: 'var(--accent)' }} />
                      <span className="ap-section-text" style={{ color: 'var(--accent)' }}>Your Reviews</span>
                    </div>
                    {mySubmission.reviews?.map((review) => {
                      const gradeLabel    = review.grade == null ? 'No grade' : `${review.grade}/20`;
                      const commentsCount = review.comments?.length ?? 0;
                      return (
                        <div key={review.id} className="ap-review-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{review.professor_name}</div>
                              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {commentsCount} line comments
                              </div>
                            </div>
                            <span className="ap-badge ap-badge-accent">{gradeLabel}</span>
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--text-sub)', marginBottom: '12px' }}>
                            {review.general_comment || 'No general comment provided.'}
                          </p>
                          {commentsCount > 0 && (
                            <>
                              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                Line Comments
                              </div>
                              {review.comments?.map((comment) => (
                                <div key={comment.id} className="ap-comment-item">
                                  <div className="ap-comment-meta">
                                    {submittedFileLabelById.get(comment.file) ?? `File #${comment.file}`} · Line {comment.line_number}
                                  </div>
                                  <div className="ap-comment-text">{comment.content}</div>
                                </div>
                              ))}
                            </>
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
            {showProfessorTable ? (
              <>
                <div className="ap-card" style={{ borderTop: `2px solid var(--blue)` }}>
                  <div className="ap-section-label">
                    <div className="ap-section-bar" style={{ background: 'var(--blue)' }} />
                    <span className="ap-section-text" style={{ color: 'var(--blue)' }}>
                      Submissions ({assignment.submission_count})
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-sub)', marginBottom: '16px' }}>
                    Review student submissions for this assignment.
                  </p>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Group Filter
                    </div>
                    <select
                      className="ap-select"
                      value={selectedGroup ?? ''}
                      onChange={(e) => setSelectedGroup(e.target.value ? Number(e.target.value) : undefined)}
                    >
                      <option value="">All groups</option>
                      {groupOptions.map((g) => <option key={g} value={g}>Group {g}</option>)}
                    </select>
                  </div>

                  {sectionError && <div className="ap-alert ap-alert-red">{sectionError}</div>}

                  {loadingSubmissions || loadingRoleData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[1,2,3].map((i) => <div key={i} className="ap-skeleton" style={{ height: 44 }} />)}
                    </div>
                  ) : submissions.length === 0 ? (
                    <div className="ap-alert" style={{ textAlign: 'center', background: 'var(--surface-2)' }}>
                      No submissions yet
                    </div>
                  ) : (
                    <div className="ap-table-wrapper">
                      <table className="ap-table">
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
                                <span style={{ fontWeight: 600 }}>{sub.student_name}</span>
                                {sub.is_late && <span className="ap-badge ap-badge-orange" style={{ marginLeft: '8px', fontSize: '9px' }}>Late</span>}
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                                {formatDateTime(sub.submitted_at)}
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                                {formatPlural(sub.file_count, 'file')}
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                                {sub.reviews_count}
                              </td>
                              <td>
                                <Link
                                  href={`/assignments/${assignment.id}/submissions/${sub.id}`}
                                  className="ap-btn ap-btn-primary ap-btn-sm"
                                  style={{ textDecoration: 'none' }}
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

                <div className="ap-card" style={{ borderTop: `2px solid var(--navy)` }}>
                  <div className="ap-section-label">
                    <div className="ap-section-bar" style={{ background: 'var(--navy)' }} />
                    <span className="ap-section-text">Summary</span>
                  </div>
                  {[
                    { label: 'Subject',    value: assignment.subject.name },
                    { label: 'Deadline',   value: formatDateTime(assignment.deadline) },
                    { label: 'Visibility', value: assignment.is_open ? 'Open' : 'Closed' },
                    { label: 'Filter',     value: groupLabel },
                  ].map(({ label, value }) => (
                    <div key={label} className="ap-summary-item">
                      <span className="ap-summary-label">{label}</span>
                      <span className="ap-summary-value">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {sectionError && (
                  <div className="ap-card">
                    <div className="ap-alert ap-alert-red">{sectionError}</div>
                  </div>
                )}
                <div className="ap-card" style={{ borderTop: `2px solid var(--navy)` }}>
                  <div className="ap-section-label">
                    <div className="ap-section-bar" style={{ background: 'var(--navy)' }} />
                    <span className="ap-section-text">Quick Facts</span>
                  </div>
                  {[
                    { label: 'Submitted Files', value: String(submittedFiles.length) },
                    { label: 'Line Comments',   value: String(lineCommentsCount) },
                    { label: 'Status',          value: assignment.is_open ? 'Open' : 'Closed' },
                  ].map(({ label, value }) => (
                    <div key={label} className="ap-summary-item">
                      <span className="ap-summary-label">{label}</span>
                      <span className="ap-summary-value">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
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