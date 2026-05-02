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
import { useAuth } from '@/hooks/useAuth';
import {
  getAssignment,
  getMySubmission,
  getSubmissions,
  submitToAssignment,
  deleteAssignment,
} from '@/services/assignments';
import type {
  Assignment,
  AssignmentSubmission,
} from '@/services/assignments';
import { relativeTime } from '@/utils/time';

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const formatFileSize = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) return '-';
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const formatPlural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

const getDeadlineBadge = (assignment: Assignment) => {
  const now = new Date();
  const deadline = new Date(assignment.deadline);
  const isPast = now > deadline;

  if (!isPast) return { label: 'Open', color: 'green' };
  if (isPast && assignment.allow_late) return { label: 'Open (Late)', color: 'orange' };
  return { label: 'Closed', color: 'red' };
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (typeof error.message === 'string' && error.message.trim()) return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const getCountdown = (deadlineValue: string): string => {
  const diff = new Date(deadlineValue).getTime() - Date.now();

  if (Number.isNaN(diff)) return 'Unavailable';
  if (diff <= 0) {
    return `Deadline passed ${relativeTime(deadlineValue)}`;
  }

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
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
  return submission.reviews.reduce(
    (total, review) => total + (review.comments?.length ?? 0),
    0
  );
};

const getTargetingSummary = (assignment: Assignment): string[] => {
  const parts = [`For ${assignment.target_year} students`];

  if (assignment.target_sections.length > 0) {
    parts.push(`Sections: ${assignment.target_sections.join(', ')}`);
  }

  if (assignment.target_groups.length > 0) {
    parts.push(`Groups: ${assignment.target_groups.join(', ')}`);
  }

  return parts;
};

const getReviewNotificationStorageKey = (submissionId: number): string =>
  `assignment-review:last-seen:${submissionId}`;

const buildReviewSignature = (submission?: AssignmentSubmission | null): string => {
  if (!submission || !submission.has_reviews) return 'none';

  const reviews = (submission.reviews ?? []).slice().sort((a, b) => a.id - b.id);
  if (reviews.length === 0) {
    return `count:${submission.reviews_count}`;
  }

  return reviews
    .map((review) => {
      const commentCount = review.comments?.length ?? 0;
      const gradeLabel = review.grade == null ? 'null' : String(review.grade);
      return `${review.id}:${review.updated_at}:${gradeLabel}:${commentCount}`;
    })
    .join('|');
};

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#f0f4ff] text-[#1a2340]">
      <Header activePage="Assignments" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-7 w-28 animate-pulse rounded-full bg-white/90" />
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          </div>
          <div className="space-y-6">
            <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          </div>
        </div>
      </main>
    </div>
  );
}

function AssignmentDetailPageContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [mySubmission, setMySubmission] = useState<AssignmentSubmission | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | undefined>(undefined);

  const [loadingAssignment, setLoadingAssignment] = useState(true);
  const [loadingRoleData, setLoadingRoleData] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const [countdown, setCountdown] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const hasLoadedRoleDataRef = useRef(false);
  const reviewNotificationReadyRef = useRef(false);
  const latestReviewSignatureRef = useRef('none');

  const persistReviewSignature = (submissionId: number, signature: string) => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(
        getReviewNotificationStorageKey(submissionId),
        signature
      );
      window.dispatchEvent(new Event('assignment-review-signature-updated'));
    } catch {
    }
  };

  const isStudent = user?.role === 'student';
  const isProfessor = user?.role === 'professor';
  const isCreator = Boolean(
    assignment &&
      user &&
      `${user.first_name} ${user.last_name}`.trim() === assignment.professor_name.trim()
  );
  const deadlineBadge = assignment ? getDeadlineBadge(assignment) : null;
  const canSubmit = Boolean(assignment?.is_open);
  const hasSubmission = Boolean(mySubmission);
  const showSubmissionClosed = Boolean(assignment && !assignment.is_open);
  const deadlinePassed = assignment
    ? new Date(assignment.deadline).getTime() <= Date.now()
    : false;

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
      setAssignmentId(null);
      setPageError('Invalid assignment id.');
      setLoadingAssignment(false);
      setInitialDataLoaded(true);
      return;
    }

    setAssignmentId(parsed);
  }, [router.isReady, router.query.id]);

  useEffect(() => {
    if (!router.isReady || assignmentId == null || !user) return;

    let cancelled = false;

    const loadAssignment = async () => {
      setLoadingAssignment(true);
      setPageError(null);
      setSectionError(null);
      setAssignment(null);
      setMySubmission(null);
      setSubmissions([]);
      setSelectedGroup(undefined);
      setShowUploadZone(false);
      setSelectedFiles([]);
      setFileInputKey((prev) => prev + 1);
      setCountdown('');
      setInitialDataLoaded(false);
      hasLoadedRoleDataRef.current = false;

      try {
        const assignmentData = await getAssignment(assignmentId);
        if (cancelled) return;

        setAssignment(assignmentData);
      } catch (error: unknown) {
        if (cancelled) return;

        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        setPageError(
          status === 403
            ? "You don't have access to this assignment"
            : getErrorMessage(error, 'Failed to load assignment.')
        );
        setInitialDataLoaded(true);
      } finally {
        if (!cancelled) {
          setLoadingAssignment(false);
        }
      }
    };

    void loadAssignment();

    return () => {
      cancelled = true;
    };
  }, [assignmentId, router.isReady, user]);

  useEffect(() => {
    if (!assignment || !user || assignmentId == null) return;

    let cancelled = false;

    const loadRoleData = async () => {
      setLoadingRoleData(true);
      setSectionError(null);

      try {
        if (isStudent) {
          try {
            const submission = await getMySubmission(assignmentId);
            if (cancelled) return;
            setMySubmission(submission);
          } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              if (!cancelled) setMySubmission(null);
            } else {
              throw error;
            }
          }
        } else {
          setLoadingSubmissions(true);
          const response = await getSubmissions(assignmentId, selectedGroup);
          if (cancelled) return;
          setSubmissions(response.results);
        }
      } catch (error: unknown) {
        if (cancelled) return;

        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        const message =
          status === 403
            ? "You don't have access to this assignment"
            : getErrorMessage(error, 'Failed to load assignment data.');

        if (!hasLoadedRoleDataRef.current) {
          setPageError(message);
        } else {
          setSectionError(message);
        }
      } finally {
        if (!cancelled) {
          setLoadingRoleData(false);
          setLoadingSubmissions(false);
          setInitialDataLoaded(true);
          hasLoadedRoleDataRef.current = true;
        }
      }
    };

    void loadRoleData();

    return () => {
      cancelled = true;
    };
  }, [assignment, assignmentId, isStudent, selectedGroup, user]);

  useEffect(() => {
    reviewNotificationReadyRef.current = false;
    latestReviewSignatureRef.current = 'none';
  }, [assignmentId, isStudent]);

  useEffect(() => {
    if (!isStudent || !mySubmission) return;

    const signature = buildReviewSignature(mySubmission);
    latestReviewSignatureRef.current = signature;

    if (typeof window === 'undefined') {
      reviewNotificationReadyRef.current = true;
      return;
    }

    const storageKey = getReviewNotificationStorageKey(mySubmission.id);
    let previousSignature: string | null = null;

    try {
      previousSignature = window.localStorage.getItem(storageKey);
    } catch {
      previousSignature = null;
    }

    const hasSignatureChange = previousSignature !== signature;
    if (!reviewNotificationReadyRef.current) {
      if (hasSignatureChange) {
        if (previousSignature === null && signature !== 'none') {
          setToast({
            type: 'info',
            message: 'Your professor sent a new review on this assignment.',
          });
        } else if (previousSignature === 'none' && signature !== 'none') {
          setToast({
            type: 'info',
            message: 'Your professor sent a new review on this assignment.',
          });
        } else if (previousSignature && previousSignature !== 'none' && signature !== 'none') {
          setToast({
            type: 'info',
            message: 'Your professor updated a previous review on this assignment.',
          });
        }
      }

      persistReviewSignature(mySubmission.id, signature);

      reviewNotificationReadyRef.current = true;
      return;
    }

    if (!hasSignatureChange) return;

    if (previousSignature === 'none' && signature !== 'none') {
      setToast({
        type: 'info',
        message: 'Your professor sent a new review on this assignment.',
      });
    } else if (previousSignature && previousSignature !== 'none' && signature !== 'none') {
      setToast({
        type: 'info',
        message: 'Your professor updated a previous review on this assignment.',
      });
    }

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
        if (
          latestSignature !== latestReviewSignatureRef.current ||
          latestSubmission.reviews_count !== mySubmission.reviews_count
        ) {
          latestReviewSignatureRef.current = latestSignature;
          setMySubmission(latestSubmission);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setMySubmission(null);
        }
      }
    };

    const interval = window.setInterval(() => {
      if (!uploading) {
        void syncStudentSubmission();
      }
    }, 20000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !uploading) {
        void syncStudentSubmission();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [assignmentId, isStudent, mySubmission, uploading]);

  useEffect(() => {
    if (!assignment) return;

    const updateCountdown = () => {
      setCountdown(getCountdown(assignment.deadline));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(interval);
  }, [assignment]);

  const reloadStudentSubmission = async () => {
    if (assignmentId == null) return;

    try {
      const submission = await getMySubmission(assignmentId);
      setMySubmission(submission);
      setShowUploadZone(false);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setMySubmission(null);
        return;
      }
      throw error;
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const picked = Array.from(event.target.files);
    setSelectedFiles((previous) => [...previous, ...picked]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const dropped = Array.from(event.dataTransfer.files);
    setSelectedFiles((previous) => [...previous, ...dropped]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!assignmentId || selectedFiles.length === 0) return;

    setUploading(true);
    setSectionError(null);

    try {
      await submitToAssignment(
        assignmentId,
        selectedFiles,
        selectedFiles.map((file) => file.name)
      );
      await reloadStudentSubmission();
      setSelectedFiles([]);
      setFileInputKey((previous) => previous + 1);
      setToast({ type: 'success', message: 'Submission uploaded successfully.' });
    } catch (error: unknown) {
      setToast({
        type: 'error',
        message: getErrorMessage(error, 'Failed to upload submission.'),
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!assignmentId) return;
    const confirmed = window.confirm('Delete this assignment? This cannot be undone.');
    if (!confirmed) return;

    setDeleteLoading(true);
    try {
      await deleteAssignment(assignmentId);
      await router.push('/assignments');
    } catch (error: unknown) {
      setToast({
        type: 'error',
        message: getErrorMessage(error, 'Failed to delete assignment.'),
      });
      setDeleteLoading(false);
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
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
      <div className="min-h-screen bg-[#f0f4ff] text-[#1a2340]">
        <Header activePage="Assignments" />
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span aria-hidden="true">←</span>
              Back
            </button>
            <h1 className="mt-6 text-2xl font-bold text-slate-900">Unable to load assignment</h1>
            <p className="mt-2 text-sm text-slate-600">
              {pageError ?? 'Unknown error.'}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const submittedFiles = mySubmission?.files ?? [];
  const submittedFileLabelById = new Map<number, string>(
    submittedFiles.map((file) => [file.id, file.file_path || file.file_name])
  );
  const lineCommentsCount = getSubmissionLineCommentsCount(mySubmission);
  const targetSummary = getTargetingSummary(assignment);
  const groupOptions = assignment.target_groups.slice().sort((a, b) => a - b);
  const groupLabel = selectedGroup == null ? 'All groups' : `Group ${selectedGroup}`;
  const showStudentUploadZone = isStudent && canSubmit && (!hasSubmission || showUploadZone);
  const showSubmittedFiles = Boolean(mySubmission && submittedFiles.length > 0);
  const showStudentClosedBanner = isStudent && showSubmissionClosed;
  const showProfessorTable = isProfessor;

  return (
    <div className="min-h-screen bg-[#f0f4ff] text-[#1a2340]">
      <Header activePage="Assignments" />

      {toast && (
        <div
          className={
            'fixed right-4 top-4 z-50 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ' +
            (toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : toast.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : 'border-blue-200 bg-blue-50 text-blue-900')
          }
        >
          <p className="text-sm font-semibold">
            {toast.type === 'success'
              ? 'Success'
              : toast.type === 'error'
                ? 'Error'
                : 'Notification'}
          </p>
          <p className="mt-1 text-sm">{toast.message}</p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 pb-20 sm:px-6 lg:px-8">
        <nav className="mb-7 flex items-center gap-2 text-sm">
          <Link href="/assignments" className="font-medium text-blue-600 hover:underline">
            Assignments
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">Assignment detail</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
                      {assignment.subject.code}
                    </span>
                    {deadlineBadge && (
                      <span
                        className={
                          'rounded-full px-3 py-1 text-xs font-bold ' +
                          (deadlineBadge.color === 'green'
                            ? 'bg-emerald-50 text-emerald-700'
                            : deadlineBadge.color === 'orange'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700')
                        }
                      >
                        {deadlineBadge.label}
                      </span>
                    )}
                  </div>
                  <div>
                    <h1 className="text-3xl font-black leading-tight text-[#0d1b2a] sm:text-4xl">
                      {assignment.title}
                    </h1>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      Professor: {assignment.professor_name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Posted {relativeTime(assignment.created_at)}
                    </p>
                  </div>
                </div>

                {(isProfessor || isCreator) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {isProfessor && (
                      <button
                        type="button"
                        onClick={handleRunPlagiarism}
                        disabled={!deadlinePassed}
                        title={
                          deadlinePassed
                            ? 'Run plagiarism check'
                            : 'Available after the deadline passes.'
                        }
                        className={
                          'rounded-xl px-4 py-2 text-sm font-semibold transition-colors ' +
                          (deadlinePassed
                            ? 'bg-slate-900 text-white hover:bg-slate-800'
                            : 'cursor-not-allowed bg-slate-200 text-slate-500')
                        }
                      >
                        Run Plagiarism Check
                      </button>
                    )}
                    {isCreator && (
                      <Link
                        href={`/assignments/${assignment.id}/edit`}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                    )}
                    {isCreator && (
                      <button
                        type="button"
                        onClick={handleDeleteAssignment}
                        disabled={deleteLoading}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deleteLoading ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {assignment.description && (
                <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {assignment.description}
                </div>
              )}

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Targeting
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    {targetSummary.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Deadline
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatDateTime(assignment.deadline)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{countdown}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Status
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {assignment.is_open ? 'Assignment is open' : 'Assignment is closed'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {assignment.allow_late ? 'Late submissions are allowed.' : 'Late submissions are not allowed.'}
                  </p>
                </div>
              </div>
            </section>

            {isStudent ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#0d1b2a]">Your Submission</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Submit your code files for this assignment.
                    </p>
                  </div>
                  {hasSubmission && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      Submitted
                    </span>
                  )}
                </div>

                {mySubmission && !assignment.is_open && (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    Submission closed
                  </div>
                )}

                {mySubmission && assignment.is_open && (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    Submitted successfully
                  </div>
                )}

                {showStudentClosedBanner && !mySubmission && (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    Submission closed. You did not submit before the deadline.
                  </div>
                )}

                {mySubmission ? (
                  <div className="mt-6 space-y-5">
                    {showSubmittedFiles ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">Submitted files</p>
                          {mySubmission?.is_late && (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                              Late submission
                            </span>
                          )}
                        </div>
                        <ul className="mt-3 space-y-2">
                          {submittedFiles.map((file) => (
                            <li
                              key={file.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm shadow-sm"
                            >
                              <div>
                                <p className="font-semibold text-slate-900">{file.file_name}</p>
                                <p className="text-xs text-slate-500">{formatFileSize(file.file_size)}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        Your submission was received, but the file list is not available.
                      </div>
                    )}

                    {assignment.is_open && !showUploadZone && (
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowUploadZone(true)}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                          title="This will replace your previous submission"
                        >
                          Resubmit
                        </button>
                        <p className="text-xs text-slate-500">This will replace your previous submission.</p>
                      </div>
                    )}
                  </div>
                ) : null}

                {showStudentUploadZone && (
                  <div className="mt-6 space-y-4">
                    {mySubmission && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                        Resubmitting will replace all previous files.
                      </div>
                    )}

                    <form onSubmit={handleUpload} className="space-y-4">
                      <div
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        className={
                          'rounded-2xl border-2 border-dashed p-8 text-center transition-colors ' +
                          (dragOver
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-300 bg-slate-50')
                        }
                      >
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                            <path
                              d="M12 16V4m0 0 4 4m-4-4-4 4M4 16.5A4.5 4.5 0 0 0 8.5 21h7a4.5 4.5 0 0 0 0-9H15"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-slate-900">
                          Drop files here or click to browse
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Any file type is accepted.</p>
                        <input
                          key={fileInputKey}
                          type="file"
                          multiple
                          onChange={handleFileInput}
                          className="mt-4 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                        />
                      </div>

                      {selectedFiles.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-sm font-semibold text-slate-900">Selected files</p>
                          <ul className="mt-3 space-y-2">
                            {selectedFiles.map((file, index) => (
                              <li
                                key={`${file.name}-${file.lastModified}-${index}`}
                                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm"
                              >
                                <div>
                                  <p className="font-semibold text-slate-900">{file.name}</p>
                                  <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeFile(index)}
                                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-white"
                                >
                                  Remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFiles([]);
                            setFileInputKey((previous) => previous + 1);
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                          disabled={uploading}
                        >
                          Clear
                        </button>
                        <button
                          type="submit"
                          disabled={uploading || selectedFiles.length === 0}
                          className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {uploading ? 'Uploading...' : 'Submit Assignment'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {!mySubmission && !assignment.is_open && (
                  <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    You did not submit before the deadline.
                  </div>
                )}

                {mySubmission?.has_reviews && (
                  <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <h3 className="text-lg font-bold text-[#0d1b2a]">Your Reviews</h3>
                    <div className="mt-4 space-y-4">
                      {mySubmission.reviews?.map((review) => {
                        const gradeLabel = review.grade == null ? 'No grade' : `${review.grade}/20`;
                        const commentsCount = review.comments?.length ?? 0;

                        return (
                          <article
                            key={review.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">{review.professor_name}</p>
                                <p className="mt-1 text-xs text-slate-500">{commentsCount} line comments</p>
                              </div>
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                                {gradeLabel}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-700">
                              {review.general_comment || 'No general comment provided.'}
                            </p>

                            {commentsCount > 0 ? (
                              <div className="mt-4 space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                  Line comments
                                </p>

                                {review.comments?.map((comment) => (
                                  <div
                                    key={comment.id}
                                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                                  >
                                    <p className="text-xs font-semibold text-slate-500">
                                      {submittedFileLabelById.get(comment.file) ?? `File #${comment.file}`} · Line {comment.line_number}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-slate-700">
                                      {comment.content}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-4 text-xs text-slate-500">No line comments on this review.</p>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            ) : null}
          </div>

          {showProfessorTable ? (
            <aside className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#0d1b2a]">Submissions ({assignment.submission_count})</h2>
                    <p className="mt-1 text-sm text-slate-500">Review student submissions for this assignment.</p>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Group filter
                  </label>
                  <select
                    value={selectedGroup ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectedGroup(value ? Number(value) : undefined);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#1a2340] outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="">All groups</option>
                    {groupOptions.map((group) => (
                      <option key={group} value={group}>
                        Group {group}
                      </option>
                    ))}
                  </select>
                </div>

                {sectionError && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {sectionError}
                  </div>
                )}

                {loadingSubmissions || loadingRoleData ? (
                  <div className="mt-5 space-y-3">
                    <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                    No submissions yet
                  </div>
                ) : (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-[190px] w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Student name</th>
                            <th className="px-4 py-3 text-left font-semibold">Submitted at</th>
                            <th className="px-4 py-3 text-left font-semibold">Late</th>
                            <th className="px-4 py-3 text-left font-semibold">Files</th>
                            <th className="px-4 py-3 text-left font-semibold">Reviews count</th>
                            <th className="sticky right-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold shadow-[-1px_0_0_0_#e2e8f0]">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {submissions.map((submission) => (
                            <tr key={submission.id} className="group hover:bg-slate-50/80">
                              <td className="px-4 py-3 font-semibold text-slate-900">{submission.student_name}</td>
                              <td className="px-4 py-3 text-slate-600">{formatDateTime(submission.submitted_at)}</td>
                              <td className="px-4 py-3">
                                {submission.is_late ? (
                                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                                    Late
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-600">{formatPlural(submission.file_count, 'file')}</td>
                              <td className="px-4 py-3 text-slate-600">
                                {submission.reviews_count}
                              </td>
                              <td className="sticky right-0 bg-white px-4 py-3 shadow-[-1px_0_0_0_#e2e8f0] group-hover:bg-slate-50/80">
                                <Link
                                  href={`/assignments/${assignment.id}/submissions/${submission.id}`}
                                  className="inline-block whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
                                >
                                  Review
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-[#0d1b2a]">Assignment summary</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <p>
                    Subject: <span className="font-semibold text-slate-900">{assignment.subject.name}</span>
                  </p>
                  <p>
                    Deadline: <span className="font-semibold text-slate-900">{formatDateTime(assignment.deadline)}</span>
                  </p>
                  <p>
                    Visibility: <span className="font-semibold text-slate-900">{assignment.is_open ? 'Open' : 'Closed'}</span>
                  </p>
                  <p>
                    Filter: <span className="font-semibold text-slate-900">{groupLabel}</span>
                  </p>
                </div>
              </section>
            </aside>
          ) : (
            <aside className="space-y-6">
              {sectionError && (
                <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {sectionError}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-[#0d1b2a]">Quick facts</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <p>
                    Submitted files: <span className="font-semibold text-slate-900">{submittedFiles.length}</span>
                  </p>
                  <p>
                    Line comments: <span className="font-semibold text-slate-900">{lineCommentsCount}</span>
                  </p>
                  <p>
                    Status: <span className="font-semibold text-slate-900">{assignment.is_open ? 'Open' : 'Closed'}</span>
                  </p>
                </div>
              </section>
            </aside>
          )}
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
