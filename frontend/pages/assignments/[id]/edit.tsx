import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import axios from 'axios';

import Header from '@/components/submissions/Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/lib/axios';
import {
  updateAssignment,
  uploadAssignmentDescriptionPdf,
  type Assignment,
} from '@/services/assignments';

type FieldErrors = {
  title?: string;
  deadline?: string;
  descriptionPdf?: string;
};

const fetchAssignment = async (url: string): Promise<Assignment> => {
  const res = await apiClient.get<Assignment>(url);
  return res.data;
};

const toLocalDateTimeValue = (value: string): string => {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatFileSize = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) return '-';
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const getPdfFilename = (value: string): string => {
  try {
    const url = new URL(value);
    const filename = url.pathname.split('/').pop();
    return filename || 'assignment.pdf';
  } catch {
    const fallback = value.split('/').pop();
    return fallback || 'assignment.pdf';
  }
};

const isPdfFile = (file: File): boolean => {
  if (file.type === 'application/pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
};

const resolveAssignmentPdfUrl = (value?: string | null): string | null => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const base = new URL(apiBase.endsWith('/') ? apiBase : `${apiBase}/`);

    if (value.startsWith('/api/')) {
      return `${base.protocol}//${base.host}${value}`;
    }

    if (value.startsWith('/assignments/')) {
      return new URL(value.slice(1), base).toString();
    }

    if (value.startsWith('/')) {
      return new URL(value, `${base.protocol}//${base.host}`).toString();
    }

    return new URL(value, base).toString();
  } catch {
    return null;
  }
};

function LoadingSkeleton() {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#eef2f7] to-[#e1f2ff]"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      <Header activePage="Assignments" />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
        <div className="h-6 w-40 animate-pulse rounded-full bg-white/90" />
        <div className="mt-6 space-y-6">
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      </main>
    </div>
  );
}

export default function AssignmentEditPage() {
  return (
    <ProtectedRoute allowedRole="professor">
      <AssignmentEditPageContent />
    </ProtectedRoute>
  );
}

function AssignmentEditPageContent() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const assignmentId = useMemo(() => {
    if (!router.isReady) return null;
    const raw = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
  }, [router.isReady, router.query.id]);

  const {
    data: assignment,
    error,
    mutate,
  } = useSWR<Assignment>(
    assignmentId ? `/assignments/${assignmentId}/` : null,
    fetchAssignment
  );

  const isLoading = assignmentId != null && !assignment && !error;

  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [descriptionOverride, setDescriptionOverride] = useState<string | null>(null);
  const [deadlineOverride, setDeadlineOverride] = useState<string | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const title = titleOverride ?? assignment?.title ?? '';
  const description = descriptionOverride ?? assignment?.description ?? '';
  const deadline =
    deadlineOverride ??
    (assignment?.deadline ? toLocalDateTimeValue(assignment.deadline) : '');
  const canEditAssignment = Boolean(
    assignment &&
      user &&
      user.role === 'professor' &&
      ((assignment.professor?.email &&
        assignment.professor.email.toLowerCase() === user.email.toLowerCase()) ||
        `${user.first_name} ${user.last_name}`.trim() ===
          assignment.professor_name.trim())
  );
  const hasExistingPdf = Boolean(assignment?.description_pdf);
  const existingPdfUrl = resolveAssignmentPdfUrl(assignment?.description_pdf);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const setPdfFile = (file: File) => {
    if (!isPdfFile(file)) {
      setFieldErrors((previous) => ({
        ...previous,
        descriptionPdf: 'Please upload a PDF file.',
      }));
      return;
    }

    setFieldErrors((previous) => ({
      ...previous,
      descriptionPdf: undefined,
    }));
    setSelectedPdf(file);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) setPdfFile(file);
  };

  const clearSelectedPdf = () => {
    setSelectedPdf(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignmentId || !assignment) return;

    const nextErrors: FieldErrors = {};
    if (!title.trim()) nextErrors.title = 'Title is required.';
    if (!deadline.trim()) {
      nextErrors.deadline = 'Due date is required.';
    } else if (Number.isNaN(new Date(deadline).getTime())) {
      nextErrors.deadline = 'Enter a valid due date.';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const updateData: Parameters<typeof updateAssignment>[1] = {};
      if (titleOverride !== null) {
        const normalizedTitle = title.trim();
        if (normalizedTitle !== assignment.title) {
          updateData.title = normalizedTitle;
        }
      }

      if (descriptionOverride !== null) {
        const normalizedDescription = description.trim();
        if (normalizedDescription !== (assignment.description ?? '')) {
          updateData.description = normalizedDescription;
        }
      }

      if (deadlineOverride !== null) {
        const nextDeadlineIso = new Date(deadline).toISOString();
        const currentDeadlineIso = new Date(assignment.deadline).toISOString();
        if (nextDeadlineIso !== currentDeadlineIso) {
          updateData.deadline = nextDeadlineIso;
        }
      }

      const updatedAssignment: Assignment =
        Object.keys(updateData).length > 0
          ? await updateAssignment(assignmentId, updateData)
          : assignment;

      let descriptionPdf = updatedAssignment.description_pdf;

      if (selectedPdf) {
        const uploadResponse = await uploadAssignmentDescriptionPdf(
          assignmentId,
          selectedPdf
        );
        descriptionPdf = uploadResponse.url;
      }

      await mutate(
        {
          ...updatedAssignment,
          description_pdf: descriptionPdf,
        },
        false
      );
      await router.push(`/assignments/${assignmentId}`);
    } catch (err: unknown) {
      setSubmitError(getErrorMessage(err, 'Failed to update assignment.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!router.isReady || isLoading || authLoading) {
    return <LoadingSkeleton />;
  }

  if (assignmentId == null) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#eef2f7] to-[#e1f2ff]"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        <Header activePage="Assignments" />
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
            <Link
              href="/assignments"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span aria-hidden="true">&larr;</span>
              Back to assignments
            </Link>
            <h1 className="mt-6 text-2xl font-bold text-slate-900">Invalid assignment</h1>
            <p className="mt-2 text-sm text-slate-600">Please check the assignment link.</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#eef2f7] to-[#e1f2ff]"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        <Header activePage="Assignments" />
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
            <Link
              href={`/assignments/${assignmentId}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span aria-hidden="true">&larr;</span>
              Back to assignment
            </Link>
            <h1 className="mt-6 text-2xl font-bold text-slate-900">Unable to load assignment</h1>
            <p className="mt-2 text-sm text-slate-600">
              {getErrorMessage(error, 'Failed to load assignment.')}
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!canEditAssignment) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#eef2f7] to-[#e1f2ff]"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        <Header activePage="Assignments" />
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
            <Link
              href="/assignments"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span aria-hidden="true">&larr;</span>
              Back to assignments
            </Link>
            <h1 className="mt-6 text-2xl font-bold text-slate-900">Access restricted</h1>
            <p className="mt-2 text-sm text-slate-600">
              You do not have permission to edit this assignment.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#eef2f7] to-[#e1f2ff]"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      <Header activePage="Assignments" />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
        <nav className="mb-7 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/assignments" className="font-medium text-blue-600 hover:underline">
            Assignments
          </Link>
          <span className="text-slate-400">/</span>
          <Link
            href={`/assignments/${assignmentId}`}
            className="font-medium text-blue-600 hover:underline"
          >
            Assignment detail
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">Edit</span>
        </nav>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-[#0d1b2a]">Edit assignment</h1>
              <p className="mt-2 text-sm text-slate-500">Update the title, description, due date, or PDF instructions.</p>
            </div>
            <Link
              href={`/assignments/${assignmentId}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Back to assignment
            </Link>
          </div>

          {submitError && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div>
              <label className="text-sm font-semibold text-slate-700">Title</label>
              <input
                type="text"
                value={title}
                onChange={(event) => {
                  setTitleOverride(event.target.value);
                  if (fieldErrors.title) {
                    setFieldErrors((previous) => ({ ...previous, title: undefined }));
                  }
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
              {fieldErrors.title && (
                <p className="mt-2 text-xs font-semibold text-rose-600">
                  {fieldErrors.title}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Description</label>
              <textarea
                value={description}
                onChange={(event) => setDescriptionOverride(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="Add optional instructions for students."
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Due date</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(event) => {
                  setDeadlineOverride(event.target.value);
                  if (fieldErrors.deadline) {
                    setFieldErrors((previous) => ({ ...previous, deadline: undefined }));
                  }
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
              {fieldErrors.deadline && (
                <p className="mt-2 text-xs font-semibold text-rose-600">
                  {fieldErrors.deadline}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">PDF description</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Optional PDF with assignment details for students.
                  </p>
                </div>
              </div>

              {selectedPdf ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{selectedPdf.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatFileSize(selectedPdf.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedPdf}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Remove
                  </button>
                </div>
              ) : hasExistingPdf && assignment.description_pdf ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{getPdfFilename(assignment.description_pdf)}</p>
                    <p className="text-xs text-slate-500">Current PDF description</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={openFileDialog}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      disabled={submitting}
                    >
                      Replace PDF
                    </button>
                    {existingPdfUrl ? (
                      <>
                        <a
                          href={existingPdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          View current PDF
                        </a>
                        <a
                          href={existingPdfUrl}
                          download
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          Download current PDF
                        </a>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Download link unavailable in current API response.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={openFileDialog}
                  className={
                    'mt-4 cursor-pointer rounded-2xl border-2 border-dashed px-6 py-8 text-center text-sm transition-colors ' +
                    (dragOver
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-slate-300 bg-white text-slate-600')
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openFileDialog();
                    }
                  }}
                >
                  <p className="font-semibold text-slate-900">Upload PDF description (optional)</p>
                  <p className="mt-1 text-xs text-slate-500">Drag and drop or click to browse.</p>
                </div>
              )}

              {fieldErrors.descriptionPdf && (
                <p className="mt-3 text-xs font-semibold text-rose-600">
                  {fieldErrors.descriptionPdf}
                </p>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setTitleOverride(null);
                  setDescriptionOverride(null);
                  setDeadlineOverride(null);
                  setFieldErrors({});
                  setSubmitError(null);
                  clearSelectedPdf();
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                disabled={submitting}
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
