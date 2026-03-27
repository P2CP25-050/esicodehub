import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import {
  updateSubmission,
  deleteFile,
  uploadFiles,
  getSubmission,
} from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubmissionFile {
  id: string;
  name: string;
  path: string;
  size: number; // bytes
}

interface Submission {
  id: string;
  title: string;
  description: string;
  category: string;
  accessLevel: "public" | "restricted" | "private";
  authors: string;
  version: string;
  license: string;
  tags: string[];
  doi: string;
  files: SubmissionFile[];
  owner: { email: string; name: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single tag pill with remove button */
function TagPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-base leading-none"
        aria-label={`Remove tag ${label}`}
      >
        ×
      </button>
    </span>
  );
}

/** Tags input field */
function TagsInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(value: string) {
    const trimmed = value.trim().replace(/,$/, "");
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 p-2 min-h-[44px] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <TagPill
          key={tag}
          label={tag}
          onRemove={() => onChange(tags.filter((t) => t !== tag))}
        />
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => input.trim() && addTag(input)}
        placeholder={tags.length === 0 ? "Add a tag and press Enter…" : ""}
        className="flex-1 min-w-[100px] bg-transparent text-sm outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
      />
    </div>
  );
}

/** Success banner */
function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 text-sm mb-5">
      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 5l2 2 4-4"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {message}
    </div>
  );
}

/** Delete confirmation dialog */
function DeleteModal({
  fileName,
  onConfirm,
  onCancel,
  loading,
}: {
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-base font-medium mb-2">Delete file?</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
          This will permanently remove{" "}
          <strong className="text-gray-900 dark:text-gray-100">{fileName}</strong>{" "}
          from this submission. This action cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <span className="w-3 h-3 border-2 border-red-300 border-t-red-700 rounded-full animate-spin" />
            )}
            Delete file
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Drag-and-drop dropzone ───────────────────────────────────────────────────

function Dropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      onFiles(Array.from(e.dataTransfer.files));
    },
    [onFiles]
  );

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={`
        rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors
        ${
          over
            ? "border-blue-400 bg-blue-50 dark:bg-blue-950"
            : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600"
        }
      `}
    >
      <svg
        className="mx-auto mb-3 w-9 h-9 text-gray-300 dark:text-gray-600"
        viewBox="0 0 36 36"
        fill="none"
      >
        <rect width="36" height="36" rx="8" fill="currentColor" />
        <path
          d="M18 22V14M18 14L15 17M18 14L21 17"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 26h12"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Drag and drop files here
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        or click to browse · any file type accepted
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) =>
          e.target.files && onFiles(Array.from(e.target.files))
        }
      />
    </div>
  );
}

// ─── Tab 1: Metadata ──────────────────────────────────────────────────────────

function MetadataTab({
  submission,
  onSaved,
}: {
  submission: Submission;
  onSaved: (updated: Partial<Submission>) => void;
}) {
  const [form, setForm] = useState({
    title: submission.title,
    description: submission.description,
    category: submission.category,
    accessLevel: submission.accessLevel,
    authors: submission.authors,
    version: submission.version,
    license: submission.license,
    tags: [...submission.tags],
    doi: submission.doi,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateSubmission(submission.id, form);
      setSaved(true);
      onSaved(form);
      setTimeout(() => setSaved(false), 5000);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to save. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setForm({
      title: submission.title,
      description: submission.description,
      category: submission.category,
      accessLevel: submission.accessLevel,
      authors: submission.authors,
      version: submission.version,
      license: submission.license,
      tags: [...submission.tags],
      doi: submission.doi,
    });
    setSaved(false);
    setError(null);
  }

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors";

  return (
    <div>
      {saved && <SuccessBanner message="Metadata saved successfully." />}
      {error && (
        <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Title */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Title
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Description */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Description
          </label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Category
          </label>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className={inputClass}
          >
            <option>Machine Learning</option>
            <option>Data Science</option>
            <option>Computer Vision</option>
            <option>NLP</option>
          </select>
        </div>

        {/* Access level */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Access level
          </label>
          <select
            value={form.accessLevel}
            onChange={(e) =>
              set(
                "accessLevel",
                e.target.value as "public" | "restricted" | "private"
              )
            }
            className={inputClass}
          >
            <option value="public">Public</option>
            <option value="restricted">Restricted</option>
            <option value="private">Private</option>
          </select>
        </div>

        {/* Authors */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Authors
          </label>
          <input
            type="text"
            value={form.authors}
            onChange={(e) => set("authors", e.target.value)}
            placeholder="Comma-separated names"
            className={inputClass}
          />
        </div>

        {/* Version */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Version
          </label>
          <input
            type="text"
            value={form.version}
            onChange={(e) => set("version", e.target.value)}
            className={inputClass}
          />
        </div>

        {/* License */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            License
          </label>
          <select
            value={form.license}
            onChange={(e) => set("license", e.target.value)}
            className={inputClass}
          >
            <option>MIT</option>
            <option>Apache 2.0</option>
            <option>CC BY 4.0</option>
            <option>GPL v3</option>
          </select>
        </div>

        {/* Tags */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Tags
          </label>
          <TagsInput
            tags={form.tags}
            onChange={(tags) => set("tags", tags)}
          />
        </div>

        {/* DOI */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Related DOI / URL
          </label>
          <input
            type="text"
            value={form.doi}
            onChange={(e) => set("doi", e.target.value)}
            placeholder="https://doi.org/…"
            className={inputClass}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-85 disabled:opacity-50 transition-opacity"
        >
          {saving && (
            <span className="w-3 h-3 border-2 border-gray-400 border-t-white dark:border-t-gray-900 rounded-full animate-spin" />
          )}
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          onClick={handleReset}
          disabled={saving}
          className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 transition-colors"
        >
          Discard changes
        </button>
      </div>
    </div>
  );
}

// ─── Tab 2: Files ─────────────────────────────────────────────────────────────

function FilesTab({ submission }: { submission: Submission }) {
  const [files, setFiles] = useState<SubmissionFile[]>(submission.files);
  const [deleteTarget, setDeleteTarget] = useState<SubmissionFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [staged, setStaged] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFile(submission.id, deleteTarget.id);
      setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // keep modal open so user can retry
    } finally {
      setDeleting(false);
    }
  }

  // ── Staged files ─────────────────────────────────────────────────────────

  function addStagedFiles(incoming: File[]) {
    setStaged((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...incoming.filter((f) => !existingNames.has(f.name))];
    });
    setUploadDone(false);
    setUploadError(null);
  }

  function removeStaged(name: string) {
    setStaged((prev) => prev.filter((f) => f.name !== name));
  }

  // ── Upload ───────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!staged.length) return;
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    try {
      const newFiles = await uploadFiles(submission.id, staged, (progress) => {
        setUploadProgress(progress); // 0–100
      });
      setFiles((prev) => [...prev, ...newFiles]);
      setStaged([]);
      setUploadDone(true);
      setTimeout(() => setUploadDone(false), 4000);
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Confirm delete modal */}
      {deleteTarget && (
        <DeleteModal
          fileName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => !deleting && setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {/* Current files */}
      <h3 className="text-sm font-medium mb-3">
        Current files{" "}
        <span className="text-gray-400 font-normal">({files.length})</span>
      </h3>

      {files.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-6 py-8 text-center text-sm text-gray-400 mb-7">
          No files attached to this submission yet.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-7">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_1.5fr_80px_90px] gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-900 text-xs font-medium text-gray-400 dark:text-gray-500">
            <div>Name</div>
            <div>Path</div>
            <div>Size</div>
            <div />
          </div>

          {files.map((file, i) => (
            <div
              key={file.id}
              className={`grid grid-cols-[1fr_1.5fr_80px_90px] gap-3 items-center px-4 py-3 ${
                i % 2 === 0
                  ? "bg-white dark:bg-gray-950"
                  : "bg-gray-50 dark:bg-gray-900"
              }`}
            >
              {/* Name */}
              <div className="flex items-center gap-2 text-sm font-medium truncate">
                <span className="flex-shrink-0 w-6 h-6 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 14"
                    fill="none"
                    className="text-gray-400"
                  >
                    <rect
                      x="1"
                      y="1"
                      width="10"
                      height="12"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                    <line
                      x1="3"
                      y1="5"
                      x2="9"
                      y2="5"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                    <line
                      x1="3"
                      y1="7.5"
                      x2="9"
                      y2="7.5"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                    <line
                      x1="3"
                      y1="10"
                      x2="7"
                      y2="10"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                  </svg>
                </span>
                <span className="truncate">{file.name}</span>
              </div>

              {/* Path */}
              <div className="text-xs font-mono text-gray-400 dark:text-gray-500 truncate">
                {file.path}
              </div>

              {/* Size */}
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {fmtSize(file.size)}
              </div>

              {/* Delete */}
              <div className="flex justify-end">
                <button
                  onClick={() => setDeleteTarget(file)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:opacity-80 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new files */}
      <h3 className="text-sm font-medium mb-3">Add new files</h3>

      {uploadDone && (
        <SuccessBanner message="Files uploaded successfully." />
      )}
      {uploadError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {uploadError}
        </div>
      )}

      <Dropzone onFiles={addStagedFiles} />

      {/* Staged file list */}
      {staged.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {staged.map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-sm"
            >
              <svg
                width="12"
                height="14"
                viewBox="0 0 12 14"
                fill="none"
                className="flex-shrink-0 text-gray-400"
              >
                <rect
                  x="1"
                  y="1"
                  width="10"
                  height="12"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              </svg>
              <span className="flex-1 font-medium truncate">{f.name}</span>
              <span className="text-xs text-gray-400">{fmtSize(f.size)}</span>
              <button
                onClick={() => removeStaged(f.name)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-1"
                aria-label={`Remove ${f.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="mt-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Uploading…
          </p>
          <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-1 rounded-full bg-gray-900 dark:bg-gray-100 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload button */}
      {staged.length > 0 && (
        <div className="mt-4">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-85 disabled:opacity-50 transition-opacity"
          >
            {uploading && (
              <span className="w-3 h-3 border-2 border-gray-400 border-t-white dark:border-t-gray-900 rounded-full animate-spin" />
            )}
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
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [notOwner, setNotOwner] = useState(false);
  const [activeTab, setActiveTab] = useState<"metadata" | "files">("metadata");

  // ── Load submission & access check ────────────────────────────────────────

  useEffect(() => {
    if (!id || typeof id !== "string" || !user) return;

    (async () => {
      setLoading(true);
      try {
        const data: Submission = await getSubmission(id);

        if (user.email !== data.owner.email) {
          setNotOwner(true);
          router.replace(`/submissions/${id}`);
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

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading || notOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        <span className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  if (!submission) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-5">
        <a
          href="/submissions"
          className="text-blue-500 hover:underline"
        >
          Submissions
        </a>
        <span>›</span>
        <a
          href={`/submissions/${submission.id}`}
          className="text-blue-500 hover:underline truncate max-w-[200px]"
        >
          {submission.title}
        </a>
        <span>›</span>
        <span>Edit</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-medium">Edit submission</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {submission.title}
          <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
          <span className="font-mono text-xs">ID: {submission.id}</span>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 mb-7">
        {(["metadata", "files"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100 font-medium"
                : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab === "metadata" ? "Edit metadata" : "Manage files"}
            {tab === "files" && (
              <span className="ml-1.5 text-xs text-gray-400">
                ({submission.files.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "metadata" ? (
        <MetadataTab
          submission={submission}
          onSaved={(updated) =>
            setSubmission((s) => s && { ...s, ...updated })
          }
        />
      ) : (
        <FilesTab submission={submission} />
      )}
    </div>
  );
}

// ─── Export (wrapped in ProtectedRoute) ───────────────────────────────────────

export default function EditSubmissionPageWrapper() {
  return (
    <ProtectedRoute>
      <EditSubmissionPage />
    </ProtectedRoute>
  );
}