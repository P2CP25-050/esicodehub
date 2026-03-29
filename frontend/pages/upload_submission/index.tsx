import { useState, CSSProperties, ChangeEvent } from "react";
import { useRouter } from "next/router";
import Header from "@/components/UploadSubm/Header";
import Field from "@/components/UploadSubm/Field";
import FileUpload from "@/components/UploadSubm/FileUpload";
import SubmissionPreview from "@/components/UploadSubm/SubmissionPreview";
import VisibilityToggle from "@/components/UploadSubm/VisibilityToggle";
import ProtectedRoute from "@/components/UploadSubm/Protectedroute";
// Use the existing, correct API service — not the local duplicate
import { createSubmission, uploadFiles, deleteSubmission } from "@/services/submissions/submissions.api";





const LANGUAGES: Language[] = [
  "Python", "JavaScript", "Java", "C++", "C", "SQL", "TypeScript", "Pascal", "Other",
];

// Separate display labels from API values (backend expects: review | help | sharing)
const TYPE_OPTIONS: { value: SubmissionTypeValue; label: string }[] = [
  { value: "review",  label: "Review Request" },
  { value: "help",    label: "Help Request" },
  { value: "sharing", label: "Educational Sharing" },
];

type SubmissionTypeValue = "review" | "help" | "sharing";
type Language = "Python" | "JavaScript" | "Java" | "C++" | "SQL" | "TypeScript" | "C" | "Pascal" | "Other";

// Upload state machine
type UploadPhase =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "upload_failed"; submissionId: number; error: string };

function NewSubmissionForm() {
  const router = useRouter();

  const [title, setTitle]              = useState<string>("");
  const [language, setLanguage]        = useState<Language | "">("");
  const [type, setType]                = useState<SubmissionTypeValue | "">("");
  const [courseTag, setCourseTag]      = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [files, setFiles]              = useState<{ file: File; relativePath: string }[]>([]);
  const [visibility, setVisibility]    = useState<"public" | "private">("public");
  const [phase, setPhase]              = useState<UploadPhase>({ status: "idle" });

  const isSubmitting = phase.status === "creating";

  const resetForm = () => {
    setTitle("");
    setLanguage("");
    setType("");
    setCourseTag("");
    setDescription("");
    setFiles([]);
    setPhase({ status: "idle" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Step 1: create submission ──────────────────────────────────────
    setPhase({ status: "creating" });
    let submission;
    try {
      submission = await createSubmission({
        title,
        language,
        submission_type: type, // API value: review | help | sharing
        visibility,
        course_tag: courseTag,
        description: description !== "" ? description : undefined,
      });
    } catch (err: any) {
      setPhase({ status: "idle" });
      alert(err?.response?.data?.detail ?? "Failed to create submission. Please try again.");
      return;
    }

    // ── Step 2: upload files ───────────────────────────────────────────
    if (files.length > 0) {
      try {
        await uploadFiles(
          submission.id,
          files.map((e) => e.file),
          files.map((e) => e.relativePath),
        );
      } catch (err: any) {
        setPhase({
          status: "upload_failed",
          submissionId: submission.id,
          error: err?.response?.data?.detail ?? "File upload failed.",
        });
        return;
      }
    }

    // ── Step 3: redirect ───────────────────────────────────────────────
    router.push(`/submissions/${submission.id}`);
  };

  const handleRetryUpload = async () => {
    if (phase.status !== "upload_failed") return;
    const { submissionId } = phase;

    setPhase({ status: "creating" });
    try {
      await uploadFiles(
        submissionId,
        files.map((e) => e.file),
        files.map((e) => e.relativePath),
      );
      router.push(`/submissions/${submissionId}`);
    } catch (err: any) {
      setPhase({
        status: "upload_failed",
        submissionId,
        error: err?.response?.data?.detail ?? "File upload failed again.",
      });
    }
  };

  const handleDiscardAndReset = async () => {
    if (phase.status !== "upload_failed") return;
    try {
      await deleteSubmission(phase.submissionId);
    } catch {
      // best-effort rollback
    }
    resetForm();
  };

  // Derive display label for SubmissionPreview from the current API value
  const typeLabel = (TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "") as "Review Request" | "Help Request" | "Educational Sharing" | "";

  return (
    <div style={styles.page}>
      <Header activePage="Submissions" />

      <div style={styles.container}>
        {/* Breadcrumb */}
        <div style={styles.breadcrumb}>
          <span style={styles.breadcrumbLink}>Submissions</span>
          <span style={styles.breadcrumbSep}>/</span>
          <span style={styles.breadcrumbCurrent}>New Submission</span>
        </div>

        <div style={styles.layout}>
          {/* Form Card */}
          <form style={styles.formCard} onSubmit={handleSubmit}>
            <h2 style={styles.formTitle}>New Submission</h2>
            <p style={styles.formSubtitle}>
              Share your code, request help, or contribute an educational resource.
            </p>

            {/* ── Upload-failed banner ── */}
            {phase.status === "upload_failed" && (
              <div style={styles.errorBanner}>
                <div style={styles.errorBannerTop}>
                  <span style={styles.errorIcon}>⚠</span>
                  <strong>File upload failed</strong>
                </div>
                <p style={styles.errorMsg}>{phase.error}</p>
                <p style={styles.errorSub}>
                  Your submission was created (ID&nbsp;#{phase.submissionId}) but the files were
                  not attached. You can retry the upload or discard and start over.
                </p>
                <div style={styles.errorActions}>
                  <button
                    type="button"
                    style={styles.btnRetry}
                    onClick={handleRetryUpload}
                  >
                    Retry Upload
                  </button>
                  <button
                    type="button"
                    style={styles.btnDiscard}
                    onClick={handleDiscardAndReset}
                  >
                    Discard &amp; Start Over
                  </button>
                </div>
              </div>
            )}

            <Field label="Title" required>
              <input
                style={styles.input}
                placeholder="e.g. Implement Binary Search Tree"
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </Field>

            <div style={styles.row2}>
              <Field label="Language" required>
                <select
                  style={styles.select}
                  value={language}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setLanguage(e.target.value as Language)}
                  required
                  disabled={isSubmitting}
                >
                  <option value="">Select language</option>
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>

              <Field label="Submission Type" required>
                <select
                  style={styles.select}
                  value={type}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setType(e.target.value as SubmissionTypeValue)}
                  required
                  disabled={isSubmitting}
                >
                  <option value="">Select type</option>
                  {TYPE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Course Tag" hint="Optional — e.g. AI101, DS201">
              <input
                style={styles.input}
                placeholder="e.g. CS301"
                value={courseTag}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCourseTag(e.target.value)}
                disabled={isSubmitting}
              />
            </Field>

            <Field label="Description" hint="Explain what your code does or what help you need">
              <textarea
                style={{ ...styles.input, minHeight: 120, resize: "vertical", fontFamily: "inherit" }}
                placeholder="Describe your submission, the problem you're solving, or the help you're looking for..."
                value={description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </Field>

            <Field label="Files">
              <FileUpload files={files} onFilesChange={setFiles} />
            </Field>

            <Field label="Visibility" hint="Control who can access this item">
              <VisibilityToggle value={visibility} onChange={setVisibility} />
            </Field>

            {/* ── Progress bar ── */}
            {phase.status === "creating" && (
              <div style={styles.progressWrap}>
                <div style={styles.progressHeader}>
                  <span style={styles.progressLabel}>Uploading submission…</span>
                </div>
                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: "10%" }} />
                </div>
              </div>
            )}

            <div style={styles.actions}>
              <button
                type="button"
                style={styles.btnOutline}
                disabled={isSubmitting}
                onClick={resetForm}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ ...styles.btnPrimary, ...(isSubmitting ? styles.btnDisabled : {}) }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Uploading…" : "Upload Submission +"}
              </button>
            </div>
          </form>

          {/* Sidebar */}
          <SubmissionPreview
            title={title}
            language={language}
            type={typeLabel}
            courseTag={courseTag}
            fileCount={files.length}
          />
        </div>
      </div>
    </div>
  );
}

export default function NewSubmissionPage() {
  return (
    <ProtectedRoute>
      <NewSubmissionForm />
    </ProtectedRoute>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f0f4ff",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: "#1a2340",
  },
  container: { maxWidth: 1200, margin: "0 auto", padding: "32px 24px 64px" },
  breadcrumb: { display: "flex", alignItems: "center", gap: 8, marginBottom: 28, fontSize: 14 },
  breadcrumbLink: { color: "#2563eb", cursor: "pointer", fontWeight: 500 },
  breadcrumbSep: { color: "#94a3b8" },
  breadcrumbCurrent: { color: "#64748b" },
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr 320px",
    gap: 28,
    alignItems: "start",
  },
  formCard: {
    background: "#fff",
    borderRadius: 16,
    padding: "36px 40px",
    boxShadow: "0 4px 24px rgba(30,60,120,0.08)",
    border: "1px solid #e2e8f6",
  },
  formTitle: { fontSize: 26, fontWeight: 800, margin: "0 0 6px", color: "#0d1b2a" },
  formSubtitle: { fontSize: 14, color: "#64748b", margin: "0 0 32px" },
  input: {
    width: "100%",
    padding: "11px 14px",
    border: "1.5px solid #d1d9e6",
    borderRadius: 10,
    fontSize: 14,
    color: "#1a2340",
    background: "#f8faff",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color .2s",
  },
  select: {
    width: "100%",
    padding: "11px 14px",
    border: "1.5px solid #d1d9e6",
    borderRadius: 10,
    fontSize: 14,
    color: "#1a2340",
    background: "#f8faff",
    outline: "none",
    boxSizing: "border-box",
    appearance: "none",
    cursor: "pointer",
  },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  actions: { display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 10 },
  btnPrimary: {
    padding: "12px 28px",
    background: "linear-gradient(135deg, #1d6ef5, #1558d4)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(29,110,245,0.35)",
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
    boxShadow: "none",
  },
  btnOutline: {
    padding: "12px 24px",
    background: "#fff",
    color: "#374151",
    border: "1.5px solid #d1d9e6",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  progressWrap: {
    marginTop: 20,
    marginBottom: 4,
    background: "#f0f6ff",
    border: "1px solid #dbeafe",
    borderRadius: 10,
    padding: "14px 16px",
  },
  progressHeader: { display: "flex", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontSize: 13, color: "#1e3a5f", fontWeight: 500 },
  progressPct: { fontSize: 13, color: "#2563eb", fontWeight: 600 },
  progressTrack: {
    height: 6,
    background: "#dbeafe",
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #2563eb, #60a5fa)",
    borderRadius: 99,
  },
  errorBanner: {
    marginBottom: 24,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 10,
    padding: "16px 18px",
  },
  errorBannerTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  errorIcon: { fontSize: 16, color: "#b45309" },
  errorMsg: { fontSize: 13, color: "#92400e", margin: "0 0 6px" },
  errorSub: { fontSize: 12, color: "#b45309", margin: "0 0 12px" },
  errorActions: { display: "flex", gap: 8 },
  btnRetry: {
    padding: "8px 16px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnDiscard: {
    padding: "8px 16px",
    background: "#fff",
    color: "#92400e",
    border: "1px solid #fed7aa",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};