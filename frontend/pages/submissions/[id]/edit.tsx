import { useState, useEffect, useCallback, useRef, ReactNode } from "react";
import Head from 'next/head';
import { useRouter } from "next/router";
import  Link  from "next/link";
import axios from "axios";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/submissions/Header";
import {
  getSubmission,
  updateSubmission,
  deleteFile,
  uploadFiles,
} from "@/services/submissions/submissions.api";
import type { PersonalSubmission } from "@/services/submissions/submissions.types";
import VisibilityToggle from "@/components/submissions/VisibilityToggle";

const LANGUAGES = [
  "Python", "C", "C++", "Java", "JavaScript", "TypeScript",
  "C#", "Visual Basic", "Fortran", "ML", "Haskell",
  "Lisp", "Scheme", "Pascal", "Modula2", "Ada",
  "Perl", "TCL", "MATLAB", "VHDL", "Verilog",
  "Spice", "MIPS Assembly", "x86 Assembly", "HCL2", "Other",
] as const;
type Language = (typeof LANGUAGES)[number];

const SUBMISSION_TYPES = [
  { value: "review", label: "Review Request" },
  { value: "help", label: "Help Request" },
  { value: "sharing", label: "Educational Sharing" },
] as const;
type SubmissionTypeValue = (typeof SUBMISSION_TYPES)[number]["value"];

const inputCls = "es-input";
const btnPrimaryCls = "es-btn-primary";
const btnOutlineCls = "es-btn-outline";

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

const getUploadErrorMessage = (err: unknown, language: string): string => {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (err.response?.status === 400) {
      if (language === "Other") {
        return "Invalid file type. When 'Other' is selected, only .pdf, .txt, .docx, and .zip files are allowed.";
      } else {
        return `Invalid file type for ${language}. Only code files are allowed. If you want to upload a PDF, DOCX, or ZIP, select 'Other' as the language.`;
      }
    }
    if (typeof detail === "string" && detail.trim().length > 0) return detail;
    if (typeof err.message === "string" && err.message.trim().length > 0) return err.message;
  }
  if (err instanceof Error && err.message.trim().length > 0) return err.message;
  return "File upload failed. Please try again.";
};

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-block w-3.5 h-3.5 rounded-full border-2 animate-spin shrink-0 ${
      light ? "border-white/30 border-t-white" : "border-black/30 border-t-navy"
    }`} />
  );
}

function Field({ label, required = false, hint, children, colSpan2 = false }: {
  label: string; required?: boolean; hint?: string; children: ReactNode; colSpan2?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0 ${colSpan2 ? "col-span-1 sm:col-span-2" : ""}`}>
      <label className="block text-[13px] font-mono font-bold text-black/80 mb-2">
        {label}{required && <span className="text-red-500"> *</span>}
        {hint && <span className="font-normal text-black/40 ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-md text-green-800 text-[13px] font-medium mb-5">
      <span className="w-4.5 h-4.5 rounded-full bg-green-500 text-white flex items-center justify-center text-[11px] font-bold">✓</span>
      {message}
    </div>
  );
}
function ErrorBanner({ message }: { message: string }) {
  return <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-[13px] mb-5">{message}</div>;
}

function DeleteModal({ fileName, onConfirm, onCancel, loading }: {
  fileName: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-200 p-4">
      <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-sm shadow-2xl border border-black/10">
        <h3 className="text-lg font-(--font-display) text-black mb-2">Delete file?</h3>
        <p className="text-sm text-black/60 mb-6">This will permanently remove <strong className="text-black/90">{fileName}</strong> from this submission. This cannot be undone.</p>
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button onClick={onCancel} disabled={loading} className={`${btnOutlineCls} w-full sm:w-auto`}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="px-5 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm font-semibold hover:opacity-80 disabled:opacity-50 inline-flex items-center gap-2">
            {loading && <Spinner />}Delete file
          </button>
        </div>
      </div>
    </div>
  );
}

function Dropzone({ onFiles }: { onFiles: (f: File[]) => void }) {
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    onFiles(Array.from(e.dataTransfer.files));
  }, [onFiles]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-xl p-8 sm:p-10 text-center select-none transition-colors ${
        over ? "border-navy bg-navy/5" : "border-black/20 bg-black/[0.02] hover:border-black/30"
      }`}
    >
      {/* Upload icon */}
      <div className="flex justify-center mb-4">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#051650" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>

      <p className="text-sm font-semibold text-black/80 mb-1">Drag &amp; drop files or a folder here</p>
      <p className="text-[11px] font-mono tracking-widest uppercase text-black/35 mb-5">
        Text / Code files only · Max 50 MB total
      </p>

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={btnPrimaryCls}
        >
          Upload Files
        </button>
        <button
          type="button"
          onClick={() => dirRef.current?.click()}
          className={btnOutlineCls}
        >
          Upload Directory
        </button>
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))}
      />
      <input
        ref={dirRef}
        type="file"
        // @ts-ignore – non-standard but widely supported
        webkitdirectory=""
        mozdirectory=""
        className="hidden"
        onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))}
      />
    </div>
  );
}

function MetadataTab({ submission, onSaved }: { submission: PersonalSubmission; onSaved: (updated: PersonalSubmission) => void; }) {
  const [form, setForm] = useState({
    title: submission.title ?? "",
    description: submission.description ?? "",
    language: (submission.language ?? "") as Language | "",
    course_tag: submission.course_tag ?? "",
    submission_type: (submission.submission_type ?? "") as SubmissionTypeValue | "",
    visibility: (submission.visibility ?? "public") as "public" | "private",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm(f => ({ ...f, [key]: value })); setSaved(false); }

  async function handleSave() {
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.language) { setError("Language is required."); return; }
    setSaving(true); setError(null);
    try {
      const updated = await updateSubmission(submission.id, {
        title:           form.title,
        description:     form.description,
        language:        form.language === "Other" ? "other" : form.language,
        course_tag:      form.course_tag,
        submission_type: form.submission_type,
        visibility:      form.visibility,
      });
      setSaved(true); onSaved(updated); setTimeout(() => setSaved(false), 5000);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save."); }
    finally { setSaving(false); }
  }
  function handleReset() {
    setForm({
      title: submission.title ?? "", description: submission.description ?? "",
      language: (submission.language ?? "") as Language | "", course_tag: submission.course_tag ?? "",
      submission_type: (submission.submission_type ?? "") as SubmissionTypeValue | "",
      visibility: (submission.visibility ?? "public") as "public" | "private",
    }); setSaved(false); setError(null);
  }

  return (
    <div>
      {saved && <SuccessBanner message="Metadata saved successfully." />}
      {error && <ErrorBanner message={error} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <Field label="Title" required colSpan2>
          <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Implement Binary Search Tree" />
        </Field>
        <Field label="Language" required>
          <select className={inputCls} value={form.language} onChange={(e) => set("language", e.target.value as Language | "")}>
            <option value="">Select language</option>
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Submission type" required>
          <select className={inputCls} value={form.submission_type} onChange={(e) => set("submission_type", e.target.value as SubmissionTypeValue | "")}>
            <option value="">Select type</option>
            {SUBMISSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Course tag" hint="Optional — e.g. ALSDD, ARCHI">
          <input className={inputCls} value={form.course_tag} onChange={(e) => set("course_tag", e.target.value)} placeholder="e.g. ALSDD, ARCHI" />
        </Field>
     <Field label="Visibility">
  <VisibilityToggle
    value={form.visibility}
    onChange={(val) => set("visibility", val)}
  />
</Field>
        <Field label="Description" hint="Explain what your code does or what help you need" colSpan2>
          <textarea className={`${inputCls} min-h-27.5 resize-y`} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe your submission, the problem you're solving, or the help you're looking for…" />
        </Field>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-7 pt-5 border-t border-black/10">
        <button onClick={handleReset} disabled={saving} className={btnOutlineCls}>Discard changes</button>
        <button onClick={handleSave} disabled={saving} className={`${btnPrimaryCls} inline-flex items-center gap-2`}>{saving && <Spinner light />}{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}

function FilesTab({ submission }: { submission: PersonalSubmission }) {
  const [files, setFiles] = useState(submission.files ?? []);
  const [deleteTarget, setDeleteTarget] = useState<(typeof files)[number] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [staged, setStaged] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null); setDeleting(true);
    try {
      await deleteFile(submission.id, deleteTarget.id);
      setFiles(p => p.filter(f => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch { setDeleteError("Failed to delete file. Please try again."); }
    finally { setDeleting(false); }
  }

  function addStagedFiles(incoming: File[]) {
    setStaged(p => { const names = new Set(p.map(f => f.name)); return [...p, ...incoming.filter(f => !names.has(f.name))]; });
    setUploadDone(false); setUploadError(null);
  }

  async function handleUpload() {
    if (!staged.length) return;
    setUploading(true); setUploadError(null); setUploadProgress(0);
    try {
      const filePaths = staged.map(f => f.name);
      const newFiles = await uploadFiles(submission.id, staged, filePaths);
      setUploadProgress(100);
      setFiles(p => [...p, ...newFiles]);
      setStaged([]);
      setUploadDone(true);
      setTimeout(() => setUploadDone(false), 4000);
    } catch (err: unknown) {
      setUploadError(
        getUploadErrorMessage(
          err,
          submission.language === "other" ? "Other" : submission.language
        )
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  return (
    <div>
      {deleteTarget && <DeleteModal fileName={deleteTarget.file_name} onConfirm={handleDelete} onCancel={() => !deleting && setDeleteTarget(null)} loading={deleting} />}
      {deleteError && <ErrorBanner message={deleteError} />}
      <p className="text-[13px] font-mono font-bold text-black/80 mb-3">Current files ({files.length})</p>
      {files.length === 0 ? (
        <div className="py-8 px-4 text-center text-black/40 text-sm border-2 border-dashed border-black/20 rounded-xl bg-black/5">No files attached to this submission yet.</div>
      ) : (
        <>
          <div className="hidden md:block border border-black/10 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_1.4fr_80px_96px] gap-3 px-4 py-2.5 bg-black/5 text-[11px] font-mono font-bold text-black/60 uppercase">
              <span>Name</span><span>Path</span><span>Size</span><span />
            </div>
            {files.map((file, i) => (
              <div key={file.id} className={`grid grid-cols-[1fr_1.4fr_80px_96px] gap-3 px-4 py-3 items-center text-[13px] border-t border-black/5 ${i % 2 === 0 ? "bg-white" : "bg-black/5"}`}>
                <div className="flex items-center gap-2 min-w-0"><span className="text-base"></span><span className="font-mono font-medium text-black/80 truncate">{file.file_name}</span></div>
                <span className="text-[11px] font-mono text-black/40 truncate">{file.file_path}</span>
                <span className="text-xs text-black/50">{fmtSize(file.file_size)}</span>
                <div className="flex justify-end"><button onClick={() => setDeleteTarget(file)} className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-semibold">Delete</button></div>
              </div>
            ))}
          </div>
          <div className="md:hidden flex flex-col gap-3">
            {files.map(file => (
              <div key={file.id} className="bg-white border border-black/10 rounded-xl p-4">
                <div className="flex justify-between items-start gap-3"><div className="flex items-center gap-2"><span></span><span className="font-mono font-semibold text-sm truncate">{file.file_name}</span></div><button onClick={() => setDeleteTarget(file)} className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs">Delete</button></div>
                <div className="mt-2 pl-6"><p className="text-[11px] font-mono text-black/40 truncate">{file.file_path}</p><p className="text-xs text-black/50 mt-1">{fmtSize(file.file_size)}</p></div>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="text-[13px] font-mono font-bold text-black/80 mt-7 mb-3">Add new files</p>
      {uploadDone && <SuccessBanner message="Files uploaded successfully." />}
      {uploadError && <ErrorBanner message={uploadError} />}
      <Dropzone onFiles={addStagedFiles} />
      {staged.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {staged.map(f => (
            <div key={f.name} className="flex items-center gap-2.5 px-3.5 py-2 bg-navy/5 border border-navy/20 rounded-lg">
              <span></span><span className="flex-1 text-[13px] font-medium truncate">{f.name}</span><span className="text-xs text-black/50">{fmtSize(f.size)}</span>
              <button onClick={() => setStaged(p => p.filter(x => x.name !== f.name))} className="text-black/40 hover:text-red-500">✕</button>
            </div>
          ))}
        </div>
      )}
      {uploading && (<div className="mt-3.5"><p className="text-xs text-black/50 mb-1.5">Uploading… {uploadProgress}%</p><div className="h-1 bg-black/10 rounded-full overflow-hidden"><div className="h-1 bg-navy rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div></div>)}
      {staged.length > 0 && <div className="flex flex-col sm:flex-row sm:justify-end mt-4"><button onClick={handleUpload} disabled={uploading} className={`${btnPrimaryCls} inline-flex items-center gap-2`}>{uploading && <Spinner light />}{uploading ? "Uploading…" : `Upload ${staged.length} file${staged.length > 1 ? "s" : ""}`}</button></div>}
    </div>
  );
}

function EditSubmissionPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [submission, setSubmission] = useState<PersonalSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"metadata" | "files">("metadata");

  // Style injection
  useEffect(() => {
    if (typeof document !== "undefined") {
      const styleId = "es-edit-styles";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
          :root { --ink: #000000; --paper: #ffffff; --navy: #051650; --rule: 1.5px solid #000; --font-display: 'Playfair Display', Georgia, serif; --font-mono: 'Space Mono', monospace; --font-body: 'DM Sans', sans-serif; }
          .es-edit-page { min-height: 100vh; background: var(--paper); font-family: var(--font-body); color: var(--ink); position: relative; }
          .es-edit-page::before { content: ''; position: fixed; top: 0; right: 0; width: 340px; height: 100vh; background: var(--navy); clip-path: polygon(60px 0, 100% 0, 100% 100%, 0 100%); z-index: 0; pointer-events: none; }
          .es-container { max-width: 900px; margin: 0 auto; padding: 40px 28px 80px; position: relative; z-index: 1; }
          .es-card { background: var(--paper); border: var(--rule); border-top: 4px solid var(--navy); padding: 32px; position: relative; }
          .es-card::after { content: ''; position: absolute; bottom: -1px; right: -1px; width: 24px; height: 24px; border-bottom: 4px solid var(--navy); border-right: 4px solid var(--navy); }
          .es-input { width: 100%; padding: 10px 14px; border: var(--rule); background: #fafafa; font-family: var(--font-body); font-size: 14px; outline: none; transition: all 0.15s; }
          .es-input:focus { background: var(--paper); border-color: var(--navy); box-shadow: 3px 3px 0 var(--navy); }
          .es-btn-primary { padding: 10px 24px; background: var(--navy); color: var(--paper); border: 1.5px solid var(--navy); font-family: var(--font-mono); font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
          .es-btn-primary:hover:not(:disabled) { background: var(--ink); border-color: var(--ink); box-shadow: 4px 4px 0 var(--navy); transform: translate(-2px, -2px); }
          .es-btn-outline { padding: 10px 20px; background: transparent; color: var(--ink); border: 1.5px solid var(--ink); font-family: var(--font-mono); font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
          .es-btn-outline:hover:not(:disabled) { background: var(--ink); color: var(--paper); transform: translate(-2px, -2px); box-shadow: 4px 4px 0 #bbb; }
          .es-btn-outline:disabled, .es-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
          @media (max-width: 900px) { .es-edit-page::before { display: none; } .es-card { padding: 20px; } .es-container { padding: 20px 16px; } }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  useEffect(() => {
    if (!id || typeof id !== "string" || !user) return;
    const numericId = Number(id);
    if (isNaN(numericId)) { router.replace("/submissions"); return; }
    (async () => {
      setLoading(true);
      try {
        const data = await getSubmission(numericId);
        if (user.email !== data.owner?.email) { router.replace(`/submissions/${String(data.id)}`); return; }
        setSubmission(data);
      } catch { router.replace("/submissions"); }
      finally { setLoading(false); }
    })();
  }, [id, user, router]);

  if (loading) {
    return (
      <div className="es-edit-page">
        <Head><title>Edit Submission — ESICodeHub</title></Head>
        <Header activePage="Submissions" />
        <div className="flex items-center justify-center gap-2.5 min-h-[calc(100vh-64px)] text-sm text-black/50">
          <Spinner /><span>Loading…</span>
        </div>
      </div>
    );
  }
  if (!submission) return null;

  return (
    <div className="es-edit-page">
      <Head><title>{submission ? `${submission.title} — Edit Submission — ESICodeHub` : 'Edit Submission — ESICodeHub'}</title></Head>
      <Header activePage="Submissions" />
      <div className="es-container">
        <nav className="flex items-center flex-wrap gap-1.5 mb-5 text-xs sm:text-sm">
          <Link href="/submissions" className="text-navy font-mono font-bold hover:underline">Submissions</Link>
          <span className="text-black/40">/</span>
          <Link href={`/submissions/${submission.id}`} className="text-navy font-mono font-bold hover:underline truncate max-w-35 sm:max-w-65">{submission.title}</Link>
          <span className="text-black/40">/</span>
          <span className="text-black/50">Edit</span>
        </nav>

        <div className="es-card">
          <h2 className="text-xl sm:text-2xl font-(--font-display) text-black mb-1">Edit submission</h2>
          <div className="flex items-center flex-wrap gap-1 text-sm text-black/50 mb-6">
            <span className="truncate max-w-50 sm:max-w-none">{submission.title}</span>
            <span className="text-black/30 mx-1">·</span>
            <span className="font-mono text-xs">ID: {submission.id}</span>
          </div>

          <div className="flex border-b border-black/10 mb-6 overflow-x-auto">
            {(["metadata", "files"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-mono font-bold border-b-2 -mb-px whitespace-nowrap transition-colors bg-transparent ${
                activeTab === tab ? "border-navy text-navy" : "border-transparent text-black/50 hover:text-black"
              }`}>
                {tab === "metadata" ? "Edit metadata" : "Manage files"}
                {tab === "files" && <span className="ml-1.5 text-[11px] text-black/40 font-normal">({submission.files?.length ?? 0})</span>}
              </button>
            ))}
          </div>

          {activeTab === "metadata" ? (
            <MetadataTab submission={submission} onSaved={(updated) => setSubmission(updated)} />
          ) : (
            <FilesTab submission={submission} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function EditSubmissionPageWrapper() {
  return (
    <ProtectedRoute>
      <EditSubmissionPage />
    </ProtectedRoute>
  );
}