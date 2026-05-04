import { useState, ChangeEvent, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import Header from "@/components/submissions/Header";
import Field from "@/components/submissions/Field";
import FileUpload from "@/components/submissions/FileUpload";
import SubmissionPreview from "@/components/submissions/SubmissionPreview";
import VisibilityToggle from "@/components/submissions/VisibilityToggle";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { createSubmission, uploadFiles, deleteSubmission } from "@/services/submissions/submissions.api";

const LANGUAGES: Language[] = [
  "Python", "C", "C++", "Java", "JavaScript", "TypeScript",
  "C#", "Visual Basic", "Fortran", "ML", "Haskell",
  "Lisp", "Scheme", "Pascal", "Modula2", "Ada",
  "Perl", "TCL", "MATLAB", "VHDL", "Verilog",
  "Spice", "MIPS Assembly", "x86 Assembly", "HCL2",
];

const TYPE_OPTIONS: { value: SubmissionTypeValue; label: string }[] = [
  { value: "review",  label: "Review Request" },
  { value: "help",    label: "Help Request" },
  { value: "sharing", label: "Educational Sharing" },
];

type SubmissionTypeValue = "review" | "help" | "sharing";
type Language = "Python"| "C" | "C++"| "Java"| "JavaScript"| "TypeScript"|
  "C#"| "Visual Basic"| "Fortran"| "ML"| "Haskell"|
  "Lisp"| "Scheme"| "Pascal"| "Modula2"| "Ada"|
  "Perl"| "TCL"| "MATLAB"| "VHDL"| "Verilog"|
  "Spice"| "MIPS Assembly"| "x86 Assembly"| "HCL2";

type UploadPhase =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "upload_failed"; submissionId: number; error: string };

const getApiErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) return detail;
    if (typeof err.message === "string" && err.message.trim().length > 0) return err.message;
  }
  if (err instanceof Error && err.message.trim().length > 0) return err.message;
  return fallback;
};

// ─────────────────────────────────────────────
//  DESIGN SYSTEM 
//  Palette : #000000 · #ffffff · #051650
//  Display  : "Playfair Display" 
//  Mono     : "Space Mono"
//  Body     : "DM Sans"
// ─────────────────────────────────────────────
const RESPONSIVE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --ink:   #000000;
    --paper: #ffffff;
    --navy:  #051650;
    --rule:  1.5px solid #000;
    --font-display: 'Playfair Display', Georgia, serif;
    --font-mono:    'Space Mono', monospace;
    --font-body:    'DM Sans', sans-serif;
  }

  /* ── Page ── */
  .ns-page {
    min-height: 100vh;
    background: var(--paper);
    font-family: var(--font-body);
    color: var(--ink);
    position: relative;
  }

  /* Diagonal accent stripe */
  .ns-page::before {
    content: '';
    position: fixed;
    top: 0; right: 0;
    width: 340px;
    height: 100vh;
    background: var(--navy);
    clip-path: polygon(60px 0, 100% 0, 100% 100%, 0 100%);
    z-index: 0;
    pointer-events: none;
  }

  /* ── Container ── */
  .ns-container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 40px 28px 80px;
    position: relative;
    z-index: 1;
  }

  /* ── Breadcrumb ── */
  .ns-breadcrumb {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 36px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .ns-breadcrumb-link {
    color: var(--navy);
    cursor: pointer;
    font-weight: 700;
    text-decoration: none;
    border-bottom: 1.5px solid var(--navy);
    padding-bottom: 1px;
  }
  .ns-breadcrumb-sep { color: #999; }
  .ns-breadcrumb-current { color: #555; }

  /* ── Layout ── */
  .ns-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 32px;
    align-items: start;
  }

  /* ── Form Card ── */
  .ns-form-card {
    background: var(--paper);
    border: var(--rule);
    border-top: 4px solid var(--navy);
    padding: 44px 48px 40px;
    position: relative;
  }

  /* Corner tick mark */
  .ns-form-card::after {
    content: '';
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 24px;
    height: 24px;
    border-bottom: 4px solid var(--navy);
    border-right: 4px solid var(--navy);
  }

  /* ── Form Header ── */
  .ns-form-title {
    font-family: var(--font-display);
    font-size: 38px;
    font-weight: 900;
    color: var(--ink);
    margin: 0 0 6px;
    line-height: 1.08;
    letter-spacing: -0.02em;
  }
  .ns-form-title span { color: var(--navy); }

  .ns-form-subtitle {
    font-family: var(--font-body);
    font-size: 13.5px;
    color: #444;
    margin: 0 0 36px;
    font-weight: 300;
    letter-spacing: 0.01em;
  }

  /* ── Divider ── */
  .ns-divider {
    height: 1px;
    background: var(--ink);
    margin: 28px 0;
    opacity: 0.12;
  }

  /* ── Section label ── */
  .ns-section-label {
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--navy);
    font-weight: 700;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ns-section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--navy);
    opacity: 0.25;
  }

  /* ── Inputs ── */
  .ns-input, .ns-select, .ns-textarea {
    width: 100%;
    padding: 12px 16px;
    border: var(--rule);
    border-radius: 0;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 400;
    color: var(--ink);
    background: #fafafa;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    -webkit-appearance: none;
    appearance: none;
  }
  .ns-input:focus, .ns-select:focus, .ns-textarea:focus {
    background: var(--paper);
    border-color: var(--navy);
    box-shadow: 3px 3px 0 var(--navy);
  }
  .ns-input::placeholder, .ns-textarea::placeholder { color: #bbb; }
  .ns-select { cursor: pointer; }
  .ns-textarea { min-height: 124px; resize: vertical; }

  /* ── Two-col row ── */
  .ns-row2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }

  /* ── Actions ── */
  .ns-actions {
    display: flex;
    gap: 14px;
    justify-content: flex-end;
    margin-top: 14px;
    padding-top: 24px;
    border-top: var(--rule);
  }

  /* Primary — navy fill */
  .ns-btn-primary {
    padding: 13px 32px;
    background: var(--navy);
    color: var(--paper);
    border: 1.5px solid var(--navy);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s, transform 0.1s;
  }
  .ns-btn-primary:hover:not(:disabled) {
    background: var(--ink);
    border-color: var(--ink);
    box-shadow: 4px 4px 0 var(--navy);
    transform: translate(-2px, -2px);
  }
  .ns-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

  /* Outline — ghost */
  .ns-btn-outline {
    padding: 13px 26px;
    background: transparent;
    color: var(--ink);
    border: 1.5px solid var(--ink);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, transform 0.1s;
  }
  .ns-btn-outline:hover:not(:disabled) {
    background: var(--ink);
    color: var(--paper);
    transform: translate(-2px, -2px);
    box-shadow: 4px 4px 0 #bbb;
  }
  .ns-btn-outline:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Progress bar ── */
  .ns-progress-wrap {
    margin-top: 20px;
    margin-bottom: 4px;
    border: var(--rule);
    padding: 16px 18px;
    background: var(--paper);
    position: relative;
  }
  .ns-progress-wrap::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    height: 3px;
    width: 40%;
    background: var(--navy);
    animation: ns-progress-slide 1.4s ease-in-out infinite alternate;
  }
  @keyframes ns-progress-slide {
    from { left: 0; width: 25%; }
    to   { left: 60%; width: 40%; }
  }
  .ns-progress-label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--navy);
    font-weight: 700;
  }

  /* ── Error banner ── */
  .ns-error-banner {
    margin-bottom: 28px;
    border: 1.5px solid var(--ink);
    border-left: 5px solid #cc0000;
    padding: 18px 20px;
    background: #fff8f8;
  }
  .ns-error-title {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: #cc0000;
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }
  .ns-error-msg {
    font-family: var(--font-body);
    font-size: 13px;
    color: #333;
    margin: 0 0 4px;
  }
  .ns-error-sub {
    font-family: var(--font-body);
    font-size: 12px;
    color: #666;
    margin: 0 0 14px;
  }
  .ns-error-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  /* ── Retry / Discard micro-buttons ── */
  .ns-btn-retry {
    padding: 8px 18px;
    background: var(--navy);
    color: var(--paper);
    border: 1.5px solid var(--navy);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .ns-btn-discard {
    padding: 8px 18px;
    background: transparent;
    color: #cc0000;
    border: 1.5px solid #cc0000;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
  }

  /* ── Responsiveness ── */
  @media (max-width: 900px) {
    .ns-layout { grid-template-columns: 1fr; }
    .ns-page::before { display: none; }
    .ns-form-card { padding: 32px 28px; }
  }
  @media (max-width: 600px) {
    .ns-container { padding: 20px 14px 60px; }
    .ns-form-card { padding: 24px 18px; }
    .ns-form-title { font-size: 28px; }
    .ns-row2 { grid-template-columns: 1fr; gap: 0; }
    .ns-actions { flex-direction: column-reverse; }
    .ns-btn-primary, .ns-btn-outline { width: 100%; text-align: center; }
    .ns-error-actions { flex-direction: column; }
    .ns-error-actions button { width: 100%; }
  }
`;

function NewSubmissionForm() {
  const router = useRouter();

  useEffect(() => {
    if (typeof document !== "undefined") {
      const id = "ns-ink-styles";
      if (!document.getElementById(id)) {
        const tag = document.createElement("style");
        tag.id = id;
        tag.textContent = RESPONSIVE_CSS;
        document.head.appendChild(tag);
      }
    }
  }, []);

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
    setTitle(""); setLanguage(""); setType("");
    setCourseTag(""); setDescription(""); setFiles([]);
    setPhase({ status: "idle" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhase({ status: "creating" });
    let submission;
    try {
      submission = await createSubmission({
        title, language, submission_type: type, visibility,
        course_tag: courseTag,
        description: description !== "" ? description : undefined,
      });
    } catch (err: unknown) {
      setPhase({ status: "idle" });
      alert(getApiErrorMessage(err, "Failed to create submission. Please try again."));
      return;
    }

    if (files.length > 0) {
      try {
        await uploadFiles(submission.id, files.map(e => e.file), files.map(e => e.relativePath));
      } catch (err: unknown) {
        setPhase({
          status: "upload_failed",
          submissionId: submission.id,
          error: getApiErrorMessage(err, "File upload failed."),
        });
        return;
      }
    }
    router.push(`/submissions/${submission.id}`);
  };

  const handleRetryUpload = async () => {
    if (phase.status !== "upload_failed") return;
    const { submissionId } = phase;
    setPhase({ status: "creating" });
    try {
      await uploadFiles(submissionId, files.map(e => e.file), files.map(e => e.relativePath));
      router.push(`/submissions/${submissionId}`);
    } catch (err: unknown) {
      setPhase({ status: "upload_failed", submissionId, error: getApiErrorMessage(err, "File upload failed again.") });
    }
  };

  const handleDiscardAndReset = async () => {
    if (phase.status !== "upload_failed") return;
    try { await deleteSubmission(phase.submissionId); } catch { /* best-effort */ }
    resetForm();
  };

  const typeLabel = (TYPE_OPTIONS.find(o => o.value === type)?.label ?? "") as
    "Review Request" | "Help Request" | "Educational Sharing" | "";

  return (
    <div className="ns-page">
      <Header activePage="Submissions" />

      <div className="ns-container">

        {/* Breadcrumb */}
        <div className="ns-breadcrumb">
          <span className="ns-breadcrumb-link">Submissions</span>
          <span className="ns-breadcrumb-sep">/</span>
          <span className="ns-breadcrumb-current">New Submission</span>
        </div>

        <div className="ns-layout">

          {/* ── Form Card ── */}
          <form className="ns-form-card" onSubmit={handleSubmit}>

            <h2 className="ns-form-title">
              New <span>Submission</span>
            </h2>
            <p className="ns-form-subtitle">
              Share your code, request help, or contribute an educational resource.
            </p>

            {/* Upload-failed banner */}
            {phase.status === "upload_failed" && (
              <div className="ns-error-banner">
                <p className="ns-error-title">⚠ File upload failed</p>
                <p className="ns-error-msg">{phase.error}</p>
                <p className="ns-error-sub">
                  Your submission was created (ID&nbsp;#{phase.submissionId}) but no files
                  were attached. Retry or discard and start over.
                </p>
                <div className="ns-error-actions">
                  <button type="button" className="ns-btn-retry" onClick={handleRetryUpload}>
                    Retry Upload
                  </button>
                  <button type="button" className="ns-btn-discard" onClick={handleDiscardAndReset}>
                    Discard &amp; Start Over
                  </button>
                </div>
              </div>
            )}

            {/* ── Section: Core details ── */}
            <p className="ns-section-label">01 · Core Details</p>

            <Field label="Title" required>
              <input
                className="ns-input"
                placeholder="e.g. Implement Binary Search Tree"
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </Field>

            <div className="ns-row2">
              <Field label="Language" required>
                <select
                  className="ns-select"
                  value={language}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setLanguage(e.target.value as Language)}
                  required
                  disabled={isSubmitting}
                >
                  <option value="">Select language</option>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>

              <Field label="Submission Type" required>
                <select
                  className="ns-select"
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

            <div className="ns-divider" />

            {/* ── Section: Context ── */}
            <p className="ns-section-label">02 · Context</p>

            <Field label="Course Tag" hint="Optional — e.g. AI101, DS201">
              <input
                className="ns-input"
                placeholder="e.g. CS301"
                value={courseTag}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCourseTag(e.target.value)}
                disabled={isSubmitting}
              />
            </Field>

            <Field label="Description" hint="Explain what your code does or what help you need">
              <textarea
                className="ns-textarea"
                placeholder="Describe your submission, the problem you're solving, or the help you're looking for..."
                value={description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </Field>

            <div className="ns-divider" />

            {/* ── Section: Files & Visibility ── */}
            <p className="ns-section-label">03 · Files &amp; Visibility</p>

            <Field label="Files">
              <FileUpload files={files} onFilesChange={setFiles} />
            </Field>

            <Field label="Visibility" hint="Control who can access this item">
              <VisibilityToggle value={visibility} onChange={setVisibility} />
            </Field>

            {/* Progress indicator */}
            {phase.status === "creating" && (
              <div className="ns-progress-wrap">
                <span className="ns-progress-label">Uploading submission…</span>
              </div>
            )}

            {/* Actions */}
            <div className="ns-actions">
              <button
                type="button"
                className="ns-btn-outline"
                disabled={isSubmitting}
                onClick={resetForm}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="ns-btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Uploading…" : "Upload Submission +"}
              </button>
            </div>
          </form>

          {/* ── Sidebar Preview ── */}
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