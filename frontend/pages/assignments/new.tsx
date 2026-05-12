"use client";
import { useState, useEffect, ChangeEvent, DragEvent, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Header from "@/components/submissions/Header";
import Head from 'next/head';
import Field from "@/components/submissions/Field";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { listSubjects, createAssignment, uploadAssignmentDescriptionPdf } from "@/services/assignments";
import type { Subject } from "@/services/assignments";

// Types & constants

type AcademicYear = "1CP" | "2CP" | "1CS" | "2CS" | "3CS";
const ACADEMIC_YEARS: AcademicYear[] = ["1CP", "2CP", "1CS", "2CS", "3CS"];

const SECTIONS_BY_YEAR: Record<AcademicYear, string[]> = {
  "1CP": ["A", "B", "C", "D"],
  "2CP": ["A", "B", "C", "D"],
  "1CS": ["A", "B", "C", "D"],
  "2CS": ["SIQ", "SIT", "SIL", "SID"],
  "3CS": ["SIQ", "SIT", "SIL", "SID"],
};

const SPECIALITY_SUBSECTIONS = ["A", "B"];
const SUBSECTION_GROUPS: Record<string, number[]> = {
  A: [1, 2],
  B: [3, 4],
};

const ASSIGNMENT_LANGUAGES = ["python", "c", "c++", "java", "javascript"];

function getGroupsForSection(sectionIndex: number): number[] {
  const base = sectionIndex * 4 + 1;
  return [base, base + 1, base + 2, base + 3];
}

function getAvailableGroups(
  year: AcademicYear | "",
  selectedSections: string[],
  selectedSubSections: string[]
): number[] {
  if (!year) return [];
  if (year !== "2CS" && year !== "3CS") {
    const sections = SECTIONS_BY_YEAR[year];
    return selectedSections.flatMap((s) => {
      const idx = sections.indexOf(s);
      return idx >= 0 ? getGroupsForSection(idx) : [];
    });
  }
  const seen = new Set<number>();
  selectedSubSections.forEach((key) => {
    const sub = key.split("-")[1];
    SUBSECTION_GROUPS[sub]?.forEach((g) => seen.add(g));
  });
  return Array.from(seen).sort((a, b) => a - b);
}

interface FormErrors {
  subject?: string;
  title?: string;
  year?: string;
  languages?: string;
  deadline?: string;
}

function validate(fields: {
  subject: string;
  title: string;
  year: string;
  languages: string[];
  deadline: string;
}): FormErrors {
  const errors: FormErrors = {};
  if (!fields.subject) errors.subject = "Subject is required.";
  if (!fields.title.trim()) errors.title = "Title is required.";
  if (!fields.year) errors.year = "Year is required.";
  if (!fields.languages.length) errors.languages = "Select at least one language.";
  if (!fields.deadline) errors.deadline = "Deadline is required.";
  else if (new Date(fields.deadline) <= new Date())
    errors.deadline = "Deadline must be in the future.";
  return errors;
}

// CSS — editorial ink/paper/navy system (matches forum index)

const PAGE_CSS = `
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

  .na-page {
    min-height: 100vh;
    background: var(--paper);
    font-family: var(--font-body);
    color: var(--ink);
    position: relative;
  }

  /* Diagonal accent stripe */
  .na-page::before {
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

  .na-container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 40px 28px 80px;
    position: relative;
    z-index: 1;
  }

  /* Breadcrumb */
  .na-breadcrumb {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 36px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .na-breadcrumb-link {
    color: var(--navy);
    cursor: pointer;
    font-weight: 700;
    text-decoration: none;
    border-bottom: 1.5px solid var(--navy);
    padding-bottom: 1px;
  }
  .na-breadcrumb-sep { color: #999; }
  .na-breadcrumb-current { color: #555; }

  /* Page header */
  .na-page-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: var(--rule);
  }

  .na-page-title {
    font-family: var(--font-display);
    font-size: 42px;
    font-weight: 900;
    color: var(--ink);
    margin: 0 0 4px;
    line-height: 1.06;
    letter-spacing: -0.02em;
  }
  .na-page-title span { color: var(--navy); }

  .na-page-subtitle {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #666;
    margin: 0;
  }

  /* Layout */
  .na-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 32px;
    align-items: start;
  }

  /* Form card */
  .na-form-card {
    background: var(--paper);
    border: var(--rule);
    padding: 40px;
  }

  .na-form-section-title {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #888;
    margin: 0 0 20px;
    padding-bottom: 8px;
    border-bottom: 1px solid #eee;
  }

  .na-divider {
    margin: 28px 0;
    border: none;
    border-top: 1px solid #e0e0e0;
  }

  /* Inputs */
  .na-input, .na-select, .na-textarea {
    width: 100%;
    padding: 11px 14px;
    border: 1.5px solid #ccc;
    background: #fafafa;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;
    border-radius: 0;
  }
  .na-input:focus, .na-select:focus, .na-textarea:focus {
    border-color: var(--navy);
    background: var(--paper);
  }
  .na-select {
    appearance: none;
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23051650' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    padding-right: 36px;
  }
  .na-textarea {
    min-height: 100px;
    resize: vertical;
  }

  /* Chips */
  .na-chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .na-chip {
    padding: 6px 16px;
    border: 1.5px solid #bbb;
    background: var(--paper);
    color: #444;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.12s;
  }
  .na-chip:hover:not(:disabled) {
    border-color: var(--navy);
    color: var(--navy);
  }
  .na-chip.selected {
    background: var(--navy);
    border-color: var(--navy);
    color: var(--paper);
  }
  .na-chip:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Subsection row */
  .na-subsection-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .na-subsection-label {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--navy);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    min-width: 50px;
  }

  /* Toggle / checkbox row */
  .na-toggle-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .na-checkbox {
    width: 17px;
    height: 17px;
    cursor: pointer;
    accent-color: var(--navy);
  }
  .na-toggle-label {
    font-size: 14px;
    color: var(--ink);
    cursor: pointer;
  }

  .na-files-dropzone {
    border: 2px dashed #cbd5e1;
    background: #f8fafc;
    text-align: center;
    padding: 40px 24px 32px;
    color: #64748b;
    transition: border-color 0.15s, background 0.15s;
  }
  .na-files-dropzone.drag-over {
    border-color: var(--navy);
    background: #eef2ff;
  }
  .na-files-drop-title {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
  }
  .na-files-drop-subtitle {
    margin: 0 0 20px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #94a3b8;
  }
  .na-files-btn-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .na-pdf-dropzone {
    border: 2px dashed #cbd5e1;
    background: #f8fafc;
    cursor: pointer;
    text-align: center;
    padding: 32px 24px;
    color: #64748b;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .na-pdf-dropzone.drag-over {
    border-color: var(--navy);
    background: #f0f8ff;
    color: var(--navy);
  }
  .na-pdf-file {
    border: 1.5px solid #ccc;
    background: #fafafa;
    padding: 12px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .na-pdf-name {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
  }
  .na-pdf-size {
    margin: 0;
    font-size: 12px;
    color: #666;
  }
  .na-pdf-helper-title {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
    color: currentColor;
  }
  .na-pdf-helper-subtitle {
    margin: 0;
    font-size: 12px;
    color: currentColor;
  }

  /* Actions */
  .na-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 32px;
    padding-top: 24px;
    border-top: var(--rule);
  }
  .na-btn-primary {
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
    transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
  }
  .na-btn-primary:hover:not(:disabled) {
    background: var(--ink);
    border-color: var(--ink);
    box-shadow: 4px 4px 0 var(--navy);
    transform: translate(-2px, -2px);
  }
  .na-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .na-btn-outline {
    padding: 13px 24px;
    background: transparent;
    color: var(--ink);
    border: 1.5px solid #bbb;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .na-btn-outline:hover:not(:disabled) {
    border-color: var(--ink);
    color: var(--ink);
  }
  .na-btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Error states */
  .na-field-error {
    font-family: var(--font-mono);
    font-size: 11px;
    color: #c0392b;
    margin-top: 6px;
    letter-spacing: 0.05em;
  }
  .na-error-banner {
    margin-bottom: 28px;
    border: 1.5px solid #c0392b;
    padding: 16px 18px;
    background: #fff5f5;
  }
  .na-error-banner-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #c0392b;
  }
  .na-error-msg {
    font-size: 13px;
    color: #922b21;
    margin: 0;
  }

  /* Progress */
  .na-progress-wrap {
    margin: 20px 0 4px;
    border: 1px solid #ddd;
    padding: 14px 16px;
    background: #f9f9f9;
  }
  .na-progress-label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--navy);
    margin-bottom: 8px;
    display: block;
  }
  .na-progress-track {
    height: 4px;
    background: #e0e0e0;
    overflow: hidden;
  }
  .na-progress-fill {
    height: 100%;
    background: var(--navy);
    width: 30%;
    transition: width 0.3s;
  }

  /* Preview card */
  .na-preview-card {
    background: var(--paper);
    border: var(--rule);
    padding: 28px 24px;
    position: sticky;
    top: 24px;
  }
  .na-preview-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 20px;
    color: var(--ink);
    padding-bottom: 12px;
    border-bottom: var(--rule);
  }
  .na-preview-item {
    display: flex;
    gap: 12px;
    margin-bottom: 14px;
    font-size: 13px;
    line-height: 1.5;
  }
  .na-preview-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #888;
    font-weight: 700;
    width: 90px;
    flex-shrink: 0;
    padding-top: 2px;
  }
  .na-preview-value {
    color: var(--ink);
    word-break: break-word;
  }
  .na-no-groups {
    font-family: var(--font-mono);
    font-size: 11px;
    color: #888;
    letter-spacing: 0.06em;
  }

  @media (max-width: 900px) {
    .na-page::before { display: none; }
    .na-page-title { font-size: 30px; }
    .na-layout { grid-template-columns: 1fr; }
    .na-form-card { padding: 28px 24px; }
    .na-preview-card { position: static; }
  }
  @media (max-width: 600px) {
    .na-container { padding: 20px 14px 60px; }
    .na-page-title { font-size: 26px; }
    .na-page-header { flex-direction: column; }
    .na-form-card { padding: 20px 16px; }
    .na-actions { flex-direction: column-reverse; }
    .na-btn-primary, .na-btn-outline { width: 100%; text-align: center; }
    .na-subsection-row { gap: 8px; }
  }
`;

// PDF helpers

const formatFileSize = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) return '-';
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const isPdfFile = (file: File): boolean => {
  if (file.type === 'application/pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
};

// Preview

interface AssignmentPreviewProps {
  subjectName?: string;
  title: string;
  year?: AcademicYear | "";
  languages: string[];
  targetingSummary: string;
  deadline?: string;
  allowLate: boolean;
}

function AssignmentPreview({
  subjectName,
  title,
  year,
  languages,
  targetingSummary,
  deadline,
  allowLate,
}: AssignmentPreviewProps) {
  const formatDeadline = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="na-preview-card">
      <h3 className="na-preview-title">Preview</h3>
      {[
        { label: "Subject", value: subjectName || "—" },
        { label: "Title", value: title || "—" },
        { label: "Year", value: year || "—" },
        { label: "Languages", value: languages.length ? languages.join(", ") : "—" },
        { label: "Targeting", value: targetingSummary || "—" },
        { label: "Deadline", value: formatDeadline(deadline) },
        { label: "Late Subs", value: allowLate ? "Allowed" : "Not allowed" },
      ].map(({ label, value }) => (
        <div className="na-preview-item" key={label}>
          <span className="na-preview-label">{label}</span>
          <span className="na-preview-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

// Chip

interface ChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function Chip({ label, selected, onClick, disabled }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`na-chip${selected ? " selected" : ""}`}
    >
      {label}
    </button>
  );
}

// Main form

function NewAssignmentForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  //const dirInputRef = useRef<HTMLInputElement | null>(null);

  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [year, setYear] = useState<AcademicYear | "">("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [targetSections, setTargetSections] = useState<string[]>([]);
  const [targetSubSections, setTargetSubSections] = useState<string[]>([]);
  const [targetGroups, setTargetGroups] = useState<number[]>([]);
  const [deadline, setDeadline] = useState("");
  const [allowLate, setAllowLate] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    listSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]))
      .finally(() => setLoadingSubjects(false));
  }, []);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  /*const openDirDialog = () => {
    dirInputRef.current?.click();
  };*/

  const setPdfFile = (file: File) => {
    setSubmitError(null);
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

  const isSpecialityYear = year === "2CS" || year === "3CS";
  const availableSections = year ? SECTIONS_BY_YEAR[year as AcademicYear] : [];
  const availableGroups = getAvailableGroups(year, targetSections, targetSubSections);
  const showGroups =
    (!isSpecialityYear && targetSections.length > 0) ||
    (isSpecialityYear && targetSubSections.length > 0);

  const handleSectionChange = (section: string) => {
    const removing = targetSections.includes(section);
    const next = removing
      ? targetSections.filter((s) => s !== section)
      : [...targetSections, section];
    setTargetSections(next);

    if (removing && isSpecialityYear) {
      setTargetSubSections((prev) =>
        prev.filter((k) => !k.startsWith(section + "-"))
      );
      setTargetGroups((prev) => {
        const remainingSubs = targetSubSections.filter(
          (k) => !k.startsWith(section + "-")
        );
        const reachable = new Set(
          remainingSubs.flatMap((k) => SUBSECTION_GROUPS[k.split("-")[1]] ?? [])
        );
        return prev.filter((g) => reachable.has(g));
      });
    } else if (removing && year) {
      const idx = SECTIONS_BY_YEAR[year as AcademicYear].indexOf(section);
      setTargetGroups((prev) =>
        prev.filter((g) => !getGroupsForSection(idx).includes(g))
      );
    }
  };

  const handleSubSectionChange = (key: string) => {
    const removing = targetSubSections.includes(key);
    const next = removing
      ? targetSubSections.filter((k) => k !== key)
      : [...targetSubSections, key];
    setTargetSubSections(next);

    if (removing) {
      const sub = key.split("-")[1];
      const candidates = new Set(SUBSECTION_GROUPS[sub] ?? []);
      const stillReachable = new Set(
        next.flatMap((k) => SUBSECTION_GROUPS[k.split("-")[1]] ?? [])
      );
      setTargetGroups((prev) =>
        prev.filter((g) => !candidates.has(g) || stillReachable.has(g))
      );
    }
  };

  const handleGroupChange = (group: number) => {
    setTargetGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const handleLanguageToggle = (language: string) => {
    setLanguages((prev) =>
      prev.includes(language)
        ? prev.filter((item) => item !== language)
        : [...prev, language]
    );
    setErrors((prev) => ({ ...prev, languages: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validationErrors = validate({ subject, title, year, languages, deadline });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const assignment = await createAssignment({
        subject: Number(subject),
        title: title.trim(),
        description: description.trim() || undefined,
        target_year: year as AcademicYear,
        languages,
        target_sections: targetSections.length > 0 ? targetSections : undefined,
        target_groups: targetGroups.length > 0 ? targetGroups : undefined,
        deadline: new Date(deadline).toISOString(),
        allow_late: allowLate,
      });

      // Upload PDF if selected
      if (selectedPdf) {
        await uploadAssignmentDescriptionPdf(assignment.id, selectedPdf);
      }

      router.push(`/assignments/${assignment.id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(message);
      setSubmitting(false);
    }
  };

  const targetingSummary = () => {
    if (!year) return "No year selected";
    if (isSpecialityYear) {
      if (targetSubSections.length === 0) return "All specialities";
      return targetSubSections.map((k) => k.replace("-", " ")).join(", ");
    }
    if (targetSections.length === 0) return "All sections";
    if (targetGroups.length === 0) return `Sections: ${targetSections.join(", ")}`;
    return `Sections: ${targetSections.join(", ")} (Groups: ${targetGroups.join(", ")})`;
  };

  const selectedSubjectName = subjects.find((s) => String(s.id) === subject)?.name;

  return (
    <div className="na-page">
      <Head>
        <title>Create Assignment — ESICodeHub</title>
        <style id="na-ink-styles">{PAGE_CSS}</style>
      </Head>
      <Header activePage="Assignments" />

      <div className="na-container">
        {/* Breadcrumb */}
        <nav className="na-breadcrumb">
          <Link href="/assignments" className="na-breadcrumb-link">
            Assignments
          </Link>
          <span className="na-breadcrumb-sep">/</span>
          <span className="na-breadcrumb-current">New Assignment</span>
        </nav>

        {/* Page header */}
        <div className="na-page-header">
          <div>
            <h1 className="na-page-title">
              New <span>Assignment</span>
            </h1>
            <p className="na-page-subtitle">
              Define targeting, languages, and deadlines
            </p>
          </div>
        </div>

        {/* Main layout */}
        <div className="na-layout">
          {/* Form */}
          <form className="na-form-card" onSubmit={handleSubmit}>
            <p className="na-form-section-title">Assignment Details</p>

            {submitError && (
              <div className="na-error-banner">
                <div className="na-error-banner-top">
                  <span>⚠</span>
                  <span>Error</span>
                </div>
                <p className="na-error-msg">{submitError}</p>
              </div>
            )}

            <Field label="Subject" required>
              <select
                className="na-select"
                value={subject}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  setSubject(e.target.value);
                  setErrors((prev) => ({ ...prev, subject: undefined }));
                }}
                disabled={loadingSubjects || submitting}
              >
                <option value="">
                  {loadingSubjects ? "Loading subjects…" : "Select a subject"}
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
              {errors.subject && (
                <div className="na-field-error">{errors.subject}</div>
              )}
            </Field>

            <Field label="Title" required>
              <input
                className="na-input"
                placeholder="e.g. Lab Report 3 — Binary Trees"
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setTitle(e.target.value);
                  setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                disabled={submitting}
                required
              />
              {errors.title && <div className="na-field-error">{errors.title}</div>}
            </Field>

            <Field label="Description" hint="Optional — instructions or context">
              <textarea
                className="na-textarea"
                placeholder="Describe the assignment, expectations, or additional notes..."
                value={description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setDescription(e.target.value)
                }
                disabled={submitting}
              />
            </Field>

            <Field label="Languages" required>
              <div className="na-chip-group">
                {ASSIGNMENT_LANGUAGES.map((language) => (
                  <Chip
                    key={language}
                    label={language}
                    selected={languages.includes(language)}
                    onClick={() => handleLanguageToggle(language)}
                    disabled={submitting}
                  />
                ))}
              </div>
              {errors.languages && (
                <div className="na-field-error">{errors.languages}</div>
              )}
            </Field>

            <hr className="na-divider" />
            <p className="na-form-section-title">Targeting</p>

            <Field label="Year" required>
              <div className="na-chip-group">
                {ACADEMIC_YEARS.map((y) => (
                  <Chip
                    key={y}
                    label={y}
                    selected={year === y}
                    onClick={() => {
                      setYear(year === y ? "" : y);
                      setTargetSections([]);
                      setTargetSubSections([]);
                      setTargetGroups([]);
                      setErrors((prev) => ({ ...prev, year: undefined }));
                    }}
                    disabled={submitting}
                  />
                ))}
              </div>
              {errors.year && <div className="na-field-error">{errors.year}</div>}
            </Field>

            {year && (
              <>
                <Field
                  label={isSpecialityYear ? "Speciality" : "Section"}
                  hint="Optional — leave empty for all"
                >
                  <div className="na-chip-group">
                    {availableSections.map((s) => (
                      <Chip
                        key={s}
                        label={s}
                        selected={targetSections.includes(s)}
                        onClick={() => handleSectionChange(s)}
                        disabled={submitting}
                      />
                    ))}
                  </div>
                </Field>

                {isSpecialityYear && targetSections.length > 0 && (
                  <Field label="Section" hint="Optional — 2 per speciality">
                    {targetSections.map((spec) => (
                      <div key={spec} className="na-subsection-row">
                        <span className="na-subsection-label">{spec}</span>
                        <div className="na-chip-group">
                          {SPECIALITY_SUBSECTIONS.map((sub) => {
                            const key = `${spec}-${sub}`;
                            return (
                              <Chip
                                key={key}
                                label={sub}
                                selected={targetSubSections.includes(key)}
                                onClick={() => handleSubSectionChange(key)}
                                disabled={submitting}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </Field>
                )}

                {showGroups && (
                  <Field
                    label="Groups"
                    hint={`Optional — ${isSpecialityYear ? "2 per section" : "4 per section"}`}
                  >
                    {availableGroups.length === 0 ? (
                      <p className="na-no-groups">
                        Select a section to reveal groups.
                      </p>
                    ) : (
                      <div className="na-chip-group">
                        {availableGroups.map((g) => (
                          <Chip
                            key={g}
                            label={String(g)}
                            selected={targetGroups.includes(g)}
                            onClick={() => handleGroupChange(g)}
                            disabled={submitting}
                          />
                        ))}
                      </div>
                    )}
                  </Field>
                )}
              </>
            )}

            <hr className="na-divider" />
            <p className="na-form-section-title">Submission Settings</p>

            <Field label="Deadline" required>
              <input
                type="datetime-local"
                className="na-input"
                value={deadline}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setDeadline(e.target.value);
                  setErrors((prev) => ({ ...prev, deadline: undefined }));
                }}
                disabled={submitting}
                required
              />
              {errors.deadline && (
                <div className="na-field-error">{errors.deadline}</div>
              )}
            </Field>

            <Field label="Late submissions">
              <div className="na-toggle-row">
                <input
                  type="checkbox"
                  id="allowLate"
                  checked={allowLate}
                  onChange={(e) => setAllowLate(e.target.checked)}
                  disabled={submitting}
                  className="na-checkbox"
                />
                <label htmlFor="allowLate" className="na-toggle-label">
                  Allow students to submit after the deadline
                </label>
              </div>
            </Field>

            <Field label="Files" hint="Optional — upload assignment file or instructions">
              {selectedPdf ? (
                <div className="na-pdf-file">
                  <div>
                    <p className="na-pdf-name">{selectedPdf.name}</p>
                    <p className="na-pdf-size">
                      {formatFileSize(selectedPdf.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedPdf}
                    disabled={submitting}
                    className="na-btn-outline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`na-files-dropzone${dragOver ? ' drag-over' : ''}`}
                >
                  {/* Upload icon */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#051650" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <p className="na-files-drop-title">Drag &amp; drop file here</p>
                  <p className="na-files-drop-subtitle">PDF FILE ONLY · MAX 50 MB TOTAL</p>
                  <div className="na-files-btn-row">
                    <button
                      type="button"
                      onClick={openFileDialog}
                      disabled={submitting}
                      className="na-btn-primary"
                    >
                      Upload File
                    </button>
                    {/*<button
                      type="button"
                      onClick={openDirDialog}
                      disabled={submitting}
                      className="na-btn-outline"
                    >
                      Upload Directory
                    </button>*/}
                  </div>
                </div>
              )}
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.py,.c,.cpp,.java,.js,.ts,.cs,.html,.css,.json,.xml,.zip"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
              {/* Hidden directory input */}
              {/*<input
                ref={dirInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory=""
                mozdirectory=""
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />*/}
            </Field>

            {/* Progress */}
            {submitting && (
              <div className="na-progress-wrap">
                <span className="na-progress-label">Creating assignment…</span>
                <div className="na-progress-track">
                  <div className="na-progress-fill" />
                </div>
              </div>
            )}

            <div className="na-actions">
              <button
                type="button"
                className="na-btn-outline"
                disabled={submitting}
                onClick={() => router.back()}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="na-btn-primary"
                disabled={submitting}
              >
                {submitting ? "Creating…" : "+ Create Assignment"}
              </button>
            </div>
          </form>

          {/* Preview */}
          <AssignmentPreview
            subjectName={selectedSubjectName}
            title={title}
            year={year}
            languages={languages}
            targetingSummary={targetingSummary()}
            deadline={deadline}
            allowLate={allowLate}
          />
        </div>
      </div>
    </div>
  );
}

export default function NewAssignmentPage() {
  return (
    <ProtectedRoute>
      <NewAssignmentForm />
    </ProtectedRoute>
  );
}