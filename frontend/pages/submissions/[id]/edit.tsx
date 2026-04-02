import { useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useRouter } from "next/router";
import { Link } from "next/link";

// ── Correct imports — existing project files only ────────────────────────────
import { ProtectedRoute }   from "@/components/ProtectedRoute";
import { useAuth }          from "@/hooks/useAuth";
import Header               from "@/components/submissions/Header";
import {
  getSubmission,
  updateSubmission,
  deleteFile,
  uploadFiles,
} from "@/services/submissions/submissions.api";
import type { PersonalSubmission } from "@/services/submissions/submissions.types";

// ─── Constants (match the upload page exactly) ────────────────────────────────

const LANGUAGES = [
  "Python", "JavaScript", "Java", "C++", "C",
  "SQL", "TypeScript", "Pascal", "Other",
] as const;

type Language = (typeof LANGUAGES)[number];

// Submission type values sent to the backend
const SUBMISSION_TYPES = [
  { value: "review",  label: "Review Request"      },
  { value: "help",    label: "Help Request"         },
  { value: "sharing", label: "Educational Sharing"  },
] as const;

type SubmissionTypeValue = (typeof SUBMISSION_TYPES)[number]["value"];

// ─── Shared input class ───────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-[11px] border border-[#d1d9e6] rounded-[10px] " +
  "text-sm text-[#1a2340] bg-[#f8faff] outline-none font-[inherit] " +
  "transition focus:border-[#1d6ef5] focus:ring-2 focus:ring-[#1d6ef5]/10 appearance-none";

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024)        return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`inline-block w-3.5 h-3.5 rounded-full border-2 animate-spin flex-shrink-0 ${
        light
          ? "border-white/30 border-t-white"
          : "border-[#d1d9e6] border-t-[#1d6ef5]"
      }`}
    />
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  required = false,
  hint,
  children,
  colSpan2 = false,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  colSpan2?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0 ${colSpan2 ? "col-span-1 sm:col-span-2" : ""}`}>
      <label className="block text-[13px] font-semibold text-[#374151] mb-2">
        {label}
        {required && <span className="text-red-500"> *</span>}
        {hint      && <span className="font-normal text-[#94a3b8]"> — {hint}</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Banners ──────────────────────────────────────────────────────────────────

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-[10px] text-green-800 text-[13px] font-medium mb-5">
      <span className="w-[18px] h-[18px] rounded-full bg-green-500 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
        ✓
      </span>
      {message}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-[10px] text-red-700 text-[13px] mb-5">
      {message}
    </div>
  );
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

function DeleteModal({
  fileName, onConfirm, onCancel, loading,
}: {
  fileName: string;
  onConfirm: () => void;
  onCancel:  () => void;
  loading:   boolean;
}) {
  return (
    <div className="fixed inset-0 bg-[#0d1b2a]/55 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-sm shadow-2xl border border-[#e2e8f6]">
        <h3 className="text-lg font-extrabold text-[#0d1b2a] mb-2">Delete file?</h3>
        <p className="text-sm text-[#64748b] mb-6 leading-relaxed">
          This will permanently remove{" "}
          <strong className="text-[#1a2340]">{fileName}</strong>{" "}
          from this submission. This cannot be undone.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 bg-white text-[#374151] border border-[#d1d9e6] rounded-[10px] text-sm font-semibold hover:bg-[#f8faff] disabled:opacity-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-[10px] text-sm font-semibold hover:opacity-80 disabled:opacity-50 inline-flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {loading && <Spinner />}
            Delete file
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dropzone ─────────────────────────────────────────────────────────────────

function Dropzone({ onFiles }: { onFiles: (f: File[]) => void }) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      onFiles(Array.from(e.dataTransfer.files));
    },
    [onFiles]
  );

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-xl p-6 sm:p-9 text-center cursor-pointer select-none transition-colors ${
        over
          ? "border-blue-400 bg-blue-50"
          : "border-[#d1d9e6] bg-[#f8faff] hover:border-[#94a3b8]"
      }`}
    >
      <div className="flex justify-center mb-3">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M30 4H12C10.9391 4 9.92172 4.42143 9.17157 5.17157C8.42143 5.92172 8 6.93913 8 8V40C8 41.0609 8.42143 42.0783 9.17157 42.8284C9.92172 43.5786 10.9391 44 12 44H36C37.0609 44 38.0783 43.5786 38.8284 42.8284C39.5786 42.0783 40 41.0609 40 40V14L30 4Z"
            stroke="#4285F4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M28 4V12C28 13.0609 28.4214 14.0783 29.1716 14.8284C29.9217 15.5786 30.9391 16 32 16H40"
            stroke="#4285F4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M24 24V36" stroke="#4285F4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M30 30L24 24L18 30" stroke="#4285F4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <p className="text-sm text-[#374151] mb-1">
        <span className="text-[#2563eb] font-semibold">Click to upload</span>{" "}
        or drag &amp; drop files here
      </p>
      <p className="text-xs text-[#94a3b8]">Any file type · Max 25 MB each</p>
      <input
        ref={ref}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))}
      />
    </div>
  );
}

// ─── Tab 1 — Edit Metadata ────────────────────────────────────────────────────
// Fields: title, description, language, course_tag, submission_type, visibility
// Source of truth: PersonalSubmission from submissions.types.ts

function MetadataTab({
  submission,
  onSaved,
}: {
  submission: PersonalSubmission;
  onSaved: (updated: PersonalSubmission) => void;
}) {
  const [form, setForm] = useState({
    title:           submission.title           ?? "",
    description:     submission.description     ?? "",
    language:        (submission.language       ?? "") as Language | "",
    course_tag:      submission.course_tag      ?? "",
    submission_type: (submission.submission_type ?? "") as SubmissionTypeValue | "",
    visibility:      (submission.visibility     ?? "public") as "public" | "private",
  });

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.language)     { setError("Language is required."); return; }

    setSaving(true);
    setError(null);
    try {
      // updateSubmission(id, patch) — from services/submissions/submissions.api.ts
      const updated = await updateSubmission(submission.id, {
        title:           form.title,
        description:     form.description,
        language:        form.language,
        course_tag:      form.course_tag,
        submission_type: form.submission_type,
        visibility:      form.visibility,
      });
      setSaved(true);
      onSaved(updated);
      setTimeout(() => setSaved(false), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setForm({
      title:           submission.title           ?? "",
      description:     submission.description     ?? "",
      language:        (submission.language       ?? "") as Language | "",
      course_tag:      submission.course_tag      ?? "",
      submission_type: (submission.submission_type ?? "") as SubmissionTypeValue | "",
      visibility:      (submission.visibility     ?? "public") as "public" | "private",
    });
    setSaved(false);
    setError(null);
  }

  return (
    <div>
      {saved && <SuccessBanner message="Metadata saved successfully." />}
      {error && <ErrorBanner   message={error} />}

      {/* 2-col on sm+, 1-col on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">

        {/* Title — full width */}
        <Field label="Title" required colSpan2>
          <input
            className={inputCls}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Implement Binary Search Tree"
          />
        </Field>

        {/* Language */}
        <Field label="Language" required>
          <select
            className={inputCls}
            value={form.language}
            onChange={(e) => set("language", e.target.value as Language | "")}
          >
            <option value="">Select language</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </Field>

        {/* Submission type */}
        <Field label="Submission type" required>
          <select
            className={inputCls}
            value={form.submission_type}
            onChange={(e) => set("submission_type", e.target.value as SubmissionTypeValue | "")}
          >
            <option value="">Select type</option>
            {SUBMISSION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>

        {/* Course tag */}
        <Field label="Course tag" hint="Optional — e.g. AI101, DS201">
          <input
            className={inputCls}
            value={form.course_tag}
            onChange={(e) => set("course_tag", e.target.value)}
            placeholder="e.g. CS301"
          />
        </Field>

        {/* Visibility */}
        <Field label="Visibility">
          {/* Toggle: public / private */}
          <div className="flex items-center gap-3 h-[44px]">
            <button
              type="button"
              onClick={() => set("visibility", "public")}
              className={`flex-1 py-2.5 rounded-[10px] text-sm font-semibold border transition cursor-pointer ${
                form.visibility === "public"
                  ? "bg-[#1d6ef5] text-white border-[#1d6ef5]"
                  : "bg-[#f8faff] text-[#64748b] border-[#d1d9e6] hover:border-[#94a3b8]"
              }`}
            >
              🌐 Public
            </button>
            <button
              type="button"
              onClick={() => set("visibility", "private")}
              className={`flex-1 py-2.5 rounded-[10px] text-sm font-semibold border transition cursor-pointer ${
                form.visibility === "private"
                  ? "bg-[#1d6ef5] text-white border-[#1d6ef5]"
                  : "bg-[#f8faff] text-[#64748b] border-[#d1d9e6] hover:border-[#94a3b8]"
              }`}
            >
              🔒 Private
            </button>
          </div>
        </Field>

        {/* Description — full width */}
        <Field label="Description" hint="Explain what your code does or what help you need" colSpan2>
          <textarea
            className={`${inputCls} min-h-[110px] resize-y leading-relaxed`}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Describe your submission, the problem you're solving, or the help you're looking for…"
          />
        </Field>

      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-7 pt-5 border-t border-[#e2e8f6]">
        <button
          onClick={handleReset}
          disabled={saving}
          className="w-full sm:w-auto px-6 py-3 bg-white text-[#374151] border border-[#d1d9e6] rounded-[10px] text-sm font-semibold hover:bg-[#f8faff] disabled:opacity-50 transition cursor-pointer"
        >
          Discard changes
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-7 py-3 bg-gradient-to-br from-[#1d6ef5] to-[#1558d4] text-white border-0 rounded-[10px] text-sm font-bold shadow-[0_4px_14px_rgba(29,110,245,0.35)] hover:opacity-90 disabled:opacity-55 inline-flex items-center justify-center gap-2 transition cursor-pointer"
        >
          {saving && <Spinner light />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Tab 2 — Manage Files ─────────────────────────────────────────────────────

function FilesTab({ submission }: { submission: PersonalSubmission }) {
  // Use the files array from PersonalSubmission
  const [files,          setFiles]          = useState(submission.files ?? []);
  const [deleteTarget,   setDeleteTarget]   = useState<(typeof files)[number] | null>(null);
  const [deleting,       setDeleting]       = useState(false);
  const [staged,         setStaged]         = useState<File[]>([]);
  const [uploading,      setUploading]      = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone,     setUploadDone]     = useState(false);
  const [uploadError,    setUploadError]    = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // deleteFile(submissionId, fileId) — from submissions.api.ts
      await deleteFile(submission.id, deleteTarget.id);
      setFiles((p) => p.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
	setDeleteError("Failed to delete file. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Staged files ────────────────────────────────────────────────────────────

  function addStagedFiles(incoming: File[]) {
    setStaged((p) => {
      const names = new Set(p.map((f) => f.name));
      return [...p, ...incoming.filter((f) => !names.has(f.name))];
    });
    setUploadDone(false);
    setUploadError(null);
  }

  // ── Upload ──────────────────────────────────────────────────────────────────
  // uploadFiles(id, files, filePaths) — filePaths is required by the backend

  async function handleUpload() {
    if (!staged.length) return;
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    try {
      // file_paths derived from file names — required by the backend
      const filePaths = staged.map((f) => f.name);

      const newFiles = await uploadFiles(
        submission.id,
        staged,
        filePaths,
      );
      setUploadProgress(100);
      setFiles((p) => [...p, ...newFiles]);
      setStaged([]);
      setUploadDone(true);
      setTimeout(() => setUploadDone(false), 4000);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  return (
    <div>
      {deleteTarget && (
        <DeleteModal
          fileName={deleteTarget.file_name}
          onConfirm={handleDelete}
          onCancel={() => !deleting && setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {/* ── Current files ── */}
      <p className="text-[13px] font-bold text-[#374151] mb-3">
        Current files ({files.length})
      </p>

      {files.length === 0 ? (
        <div className="py-8 px-4 text-center text-[#94a3b8] text-sm border-2 border-dashed border-[#d1d9e6] rounded-xl bg-[#f8faff]">
          No files attached to this submission yet.
        </div>
      ) : (
        <>
          {/* Desktop table — hidden below md */}
          <div className="hidden md:block border border-[#e2e8f6] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_1.4fr_80px_96px] gap-3 px-4 py-2.5 bg-[#f8faff] text-[11px] font-bold text-[#94a3b8] uppercase tracking-wide">
              <span>Name</span><span>Path</span><span>Size</span><span />
            </div>
            {files.map((file, i) => (
              <div
                key={file.id}
                className={`grid grid-cols-[1fr_1.4fr_80px_96px] gap-3 px-4 py-3 items-center text-[13px] border-t border-[#f0f4ff] ${
                  i % 2 === 0 ? "bg-white" : "bg-[#f8faff]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base flex-shrink-0">📄</span>
                  <span className="font-medium text-[#1e3a5f] truncate">{file.file_name}</span>
                </div>
                <span className="text-[11px] font-mono text-[#94a3b8] truncate">{file.file_path}</span>
                <span className="text-xs text-[#64748b] whitespace-nowrap">{fmtSize(file.file_size)}</span>
                <div className="flex justify-end">
                  <button
                    onClick={() => setDeleteTarget(file)}
                    className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold hover:opacity-80 transition cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile cards — visible below md */}
          <div className="md:hidden flex flex-col gap-3">
            {files.map((file) => (
              <div key={file.id} className="bg-white border border-[#e2e8f6] rounded-xl p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base flex-shrink-0">📄</span>
                    <span className="font-semibold text-[#1e3a5f] text-sm truncate">{file.file_name}</span>
                  </div>
                  <button
                    onClick={() => setDeleteTarget(file)}
                    className="flex-shrink-0 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold hover:opacity-80 transition cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
                <div className="flex flex-col gap-1 pl-7">
                  <span className="text-[11px] font-mono text-[#94a3b8] truncate">{file.file_path}</span>
                  <span className="text-xs text-[#64748b]">{fmtSize(file.file_size)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Add new files ── */}
      <p className="text-[13px] font-bold text-[#374151] mt-7 mb-3">Add new files</p>

      {uploadDone  && <SuccessBanner message="Files uploaded successfully." />}
      {uploadError && <ErrorBanner   message={uploadError} />}

      <Dropzone onFiles={addStagedFiles} />

      {/* Staged list */}
      {staged.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {staged.map((f) => (
            <div key={f.name} className="flex items-center gap-2.5 px-3.5 py-2 bg-[#f0f6ff] border border-[#dbeafe] rounded-lg">
              <span className="text-base flex-shrink-0">📄</span>
              <span className="flex-1 text-[13px] font-medium text-[#1e3a5f] truncate min-w-0">{f.name}</span>
              <span className="text-xs text-[#64748b] whitespace-nowrap flex-shrink-0">{fmtSize(f.size)}</span>
              <button
                onClick={() => setStaged((p) => p.filter((x) => x.name !== f.name))}
                className="text-[#94a3b8] hover:text-red-500 text-base leading-none px-1 bg-transparent border-0 cursor-pointer transition-colors flex-shrink-0"
                aria-label={`Remove ${f.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {uploading && (
        <div className="mt-3.5">
          <p className="text-xs text-[#64748b] mb-1.5">Uploading… {uploadProgress}%</p>
          <div className="h-1 bg-[#e2e8f6] rounded-full overflow-hidden">
            <div
              className="h-1 bg-gradient-to-r from-[#1d6ef5] to-[#00c6ff] rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload button */}
      {staged.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:justify-end mt-4">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full sm:w-auto px-7 py-3 bg-gradient-to-br from-[#1d6ef5] to-[#1558d4] text-white border-0 rounded-[10px] text-sm font-bold shadow-[0_4px_14px_rgba(29,110,245,0.35)] hover:opacity-90 disabled:opacity-55 inline-flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {uploading && <Spinner light />}
            {uploading
              ? "Uploading…"
              : `Upload ${staged.length} file${staged.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function EditSubmissionPage() {
  const router              = useRouter();
  const { id }              = router.query;
  const { user }            = useAuth();

  const [submission, setSubmission] = useState<PersonalSubmission | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<"metadata" | "files">("metadata");

  // ── Fetch + access check ────────────────────────────────────────────────────

  useEffect(() => {
    if (!id || typeof id !== "string" || !user) return;

    const numericId = Number(id);
    if (isNaN(numericId)) { router.replace("/submissions"); return; }

    (async () => {
      setLoading(true);
      try {
        // getSubmission expects number — from services/submissions/submissions.api.ts
        const data = await getSubmission(numericId);

        // Access check: only the owner may edit
        if (user.email !== data.owner?.email) {
          router.replace(`/submissions/${String(data.id)}`);
          return;
        }

        setSubmission(data);
      } catch {
        router.replace("/submissions");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user, router]);

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f4ff]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <Header activePage="Submissions" />
        <div className="flex items-center justify-center gap-2.5 min-h-[calc(100vh-64px)] text-sm text-[#64748b]">
          <Spinner />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  if (!submission) return null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-[#f0f4ff] text-[#1a2340]"
      style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
    >
      <Header activePage="Submissions" />

      <div className="max-w-[900px] mx-auto px-3 sm:px-6 py-5 sm:py-8 pb-16">

        {/* Breadcrumb */}
        <nav className="flex items-center flex-wrap gap-1.5 sm:gap-2 mb-5 sm:mb-6 text-xs sm:text-sm">
          <Link href="/submissions" className="text-[#2563eb] font-medium hover:underline whitespace-nowrap">
            Submissions
          </Link>
          <span className="text-[#94a3b8]">/</span>
          <Link
            href={`/submissions/${submission.id}`}
            className="text-[#2563eb] font-medium hover:underline truncate max-w-[140px] sm:max-w-[260px]"
          >
            {submission.title}
          </Link>
          <span className="text-[#94a3b8]">/</span>
          <span className="text-[#64748b]">Edit</span>
        </nav>

        {/* Main card */}
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-8 md:p-10 shadow-[0_4px_24px_rgba(30,60,120,0.08)] border border-[#e2e8f6]">

          {/* Card header */}
          <h2 className="text-xl sm:text-2xl md:text-[26px] font-extrabold text-[#0d1b2a] mb-1">
            Edit submission
          </h2>
          <div className="flex items-center flex-wrap gap-1 text-sm text-[#64748b] mb-6 sm:mb-7">
            <span className="truncate max-w-[200px] sm:max-w-none">{submission.title}</span>
            <span className="text-[#d1d9e6] mx-1">·</span>
            <span className="font-mono text-xs text-[#94a3b8]">ID: {submission.id}</span>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-[#e2e8f6] mb-6 sm:mb-7 overflow-x-auto">
            {(["metadata", "files"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer bg-transparent flex-shrink-0 border-l-0 border-r-0 border-t-0 ${
                  activeTab === tab
                    ? "border-b-[#1d6ef5] text-[#1d6ef5] font-semibold"
                    : "border-b-transparent text-[#94a3b8] hover:text-[#1a2340]"
                }`}
              >
                {tab === "metadata" ? "Edit metadata" : "Manage files"}
                {tab === "files" && (
                  <span className="ml-1.5 text-[11px] text-[#94a3b8] font-normal">
                    ({submission.files?.length ?? 0})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "metadata" ? (
            <MetadataTab
              submission={submission}
              onSaved={(updated) => setSubmission(updated)}
            />
          ) : (
            <FilesTab submission={submission} />
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Export — wrapped with the existing ProtectedRoute ────────────────────────

export default function EditSubmissionPageWrapper() {
  return (
    <ProtectedRoute>
      <EditSubmissionPage />
    </ProtectedRoute>
  );
}
