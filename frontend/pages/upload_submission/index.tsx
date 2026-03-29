"use client";

import { useState, CSSProperties, ChangeEvent, FormEvent } from "react";
import Header from "@/components/auth/Header";
import Field from "@/components/auth/Field";
import FileUpload from "@/components/auth/FileUpload";
import SubmissionPreview from "@/components/auth/SubmissionPreview";
import SuccessScreen from "@/components/auth/SuccessScreen";


const LANGUAGES: Language[] = [
  "Python", "JavaScript", "Java", "C++", "C", "SQL", "TypeScript", "Pascal", "Other",
];
 
 const TYPES: SubmissionType[] = [
  "Review Request", "Help Request", "Educational Sharing",
];

type SubmissionType = "Review Request" | "Help Request" | "Educational Sharing";
type Language = "Python" | "JavaScript" | "Java" | "C++" | "SQL" | "TypeScript" | "C" | "Pascal" | "Other";

export default function NewSubmissionPage() {
  const [title, setTitle]               = useState<string>("");
  const [language, setLanguage]         = useState<Language | "">("");
  const [type, setType]                 = useState<SubmissionType | "">("");
  const [courseTag, setCourseTag]       = useState<string>("");
  const [description, setDescription]  = useState<string>("");
  const [files, setFiles]               = useState<File[]>([]);
  const [submitted, setSubmitted]       = useState<boolean>(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!title || !language || !type) return;
    setSubmitted(true);
  };

  const resetForm = () => {
    setTitle("");
    setLanguage("");
    setType("");
    setCourseTag("");
    setDescription("");
    setFiles([]);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div style={styles.page}>
        <Header />
        <SuccessScreen
          title={title}
          onNewSubmission={resetForm}
          onBack={resetForm}
        />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <Header />

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

            <Field label="Title" required>
              <input
                style={styles.input}
                placeholder="e.g. Implement Binary Search Tree"
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                required
              />
            </Field>

            <div style={styles.row2}>
              <Field label="Language" required>
                <select
                  style={styles.select}
                  value={language}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setLanguage(e.target.value as Language)}
                  required
                >
                  <option value="">Select language</option>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </Field>

              <Field label="Submission Type" required>
                <select
                  style={styles.select}
                  value={type}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setType(e.target.value as SubmissionType)}
                  required
                >
                  <option value="">Select type</option>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
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
              />
            </Field>

            <Field label="Description" hint="Explain what your code does or what help you need">
              <textarea
                style={{ ...styles.input, minHeight: 120, resize: "vertical", fontFamily: "inherit" }}
                placeholder="Describe your submission, the problem you're solving, or the help you're looking for..."
                value={description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              />
            </Field>

            <Field label="Files">
              <FileUpload files={files} onFilesChange={setFiles} />
            </Field>

            <div style={styles.actions}>
              <button type="button" style={styles.btnOutline}>Cancel</button>
              <button type="submit" style={styles.btnPrimary}>
                Upload Submission +
              </button>
            </div>
          </form>

          {/* Sidebar */}
          <SubmissionPreview
            title={title}
            language={language}
            type={type}
            courseTag={courseTag}
            fileCount={files.length}
          />
        </div>
      </div>
    </div>
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
};