"use client";
import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Header from "@/components/submissions/Header";
import Head from 'next/head';
import Field from "@/components/submissions/Field";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { listSubjects, createAssignment } from "@/services/assignments";
import type { Subject } from "@/services/assignments";

// ── Types & constants ─────────────────────────────────────────────────────────

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

// ── CSS ───────────────────────────────────────────────────────────────────────

const PAGE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

  :root {
    --bg:             #0d1117;
    --surface:        #161b22;
    --surface-2:      #21262d;
    --border:         #30363d;
    --accent:         #e6c97a;
    --accent-dim:     rgba(230,201,122,0.12);
    --blue:           #58a6ff;
    --blue-dim:       rgba(88,166,255,0.12);
    --orange:         #f0883e;
    --green:          #3fb950;
    --red:            #f85149;
    --text-primary:   #e6edf3;
    --text-secondary: #8b949e;
    --text-muted:     #484f58;
    --font-display:   'Lora', Georgia, serif;
    --font-mono:      'IBM Plex Mono', monospace;
    --font-body:      'DM Sans', sans-serif;
    --radius:         10px;
    --radius-lg:      16px;
    --shadow:         0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.3);
    --shadow-hover:   0 4px 8px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.4);
  }

  .na-page {
    min-height: 100vh;
    background: var(--bg);
    font-family: var(--font-body);
    color: var(--text-primary);
    position: relative;
  }
  .na-page::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none; z-index: 0;
  }

  .na-container {
    max-width: 1200px; margin: 0 auto;
    padding: 32px 28px 80px;
    position: relative; z-index: 1;
  }

  /* Breadcrumb */
  .na-breadcrumb {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 32px;
    font-family: var(--font-mono); font-size: 11px;
    letter-spacing: 0.1em; color: var(--text-muted);
  }
  .na-breadcrumb-link { color: var(--accent); text-decoration: none; transition: opacity 0.15s; }
  .na-breadcrumb-link:hover { opacity: 0.75; }

  /* Page header */
  .na-page-header {
    display: flex; flex-wrap: wrap; align-items: flex-end;
    justify-content: space-between; gap: 16px;
    padding-bottom: 28px; border-bottom: 1px solid var(--border); margin-bottom: 32px;
  }
  .na-page-title {
    font-family: var(--font-display); font-size: 36px; font-weight: 700;
    color: var(--text-primary); margin: 0 0 6px; line-height: 1.1; letter-spacing: -0.01em;
  }
  .na-page-title span { color: var(--accent); }
  .na-page-subtitle {
    font-family: var(--font-mono); font-size: 11px;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--text-secondary); margin: 0;
  }

  /* Layout */
  .na-layout { display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: start; }

  /* Form card */
  .na-form-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 32px;
    box-shadow: var(--shadow);
  }

  .na-form-section-title {
    font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--text-muted);
    margin: 0 0 20px; padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }

  .na-divider { margin: 24px 0; border: none; border-top: 1px solid var(--border); }

  /* Inputs */
  .na-input, .na-select, .na-textarea {
    width: 100%; padding: 10px 14px;
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius); color: var(--text-primary);
    font-family: var(--font-body); font-size: 13px;
    outline: none; box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .na-input::placeholder, .na-textarea::placeholder { color: var(--text-muted); }
  .na-input:focus, .na-select:focus, .na-textarea:focus {
    border-color: var(--blue);
    box-shadow: 0 0 0 3px rgba(88,166,255,0.12);
    background: var(--surface);
  }
  .na-select {
    appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b949e' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px;
  }
  .na-textarea { min-height: 100px; resize: vertical; }

  /* Chips */
  .na-chip-group { display: flex; flex-wrap: wrap; gap: 8px; }
  .na-chip {
    padding: 6px 16px;
    background: var(--surface-2); border: 1px solid var(--border);
    color: var(--text-secondary);
    font-family: var(--font-mono); font-size: 11px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    cursor: pointer; border-radius: var(--radius);
    transition: all 0.12s;
  }
  .na-chip:hover:not(:disabled) { border-color: var(--blue); color: var(--blue); background: var(--blue-dim); }
  .na-chip.selected { background: var(--accent-dim); border-color: rgba(230,201,122,0.4); color: var(--accent); }
  .na-chip:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Subsection row */
  .na-subsection-row { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
  .na-subsection-label {
    font-family: var(--font-mono); font-size: 11px; font-weight: 700;
    color: var(--accent); letter-spacing: 0.1em; text-transform: uppercase; min-width: 50px;
  }

  /* Toggle */
  .na-toggle-row { display: flex; align-items: center; gap: 10px; }
  .na-checkbox { width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent); }
  .na-toggle-label { font-size: 13px; color: var(--text-secondary); cursor: pointer; }

  /* Actions */
  .na-actions {
    display: flex; gap: 12px; justify-content: flex-end;
    margin-top: 28px; padding-top: 24px; border-top: 1px solid var(--border);
  }
  .na-btn-primary {
    padding: 11px 28px; background: var(--accent); color: #0d1117;
    border: none; border-radius: var(--radius);
    font-family: var(--font-mono); font-size: 12px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
    transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
    box-shadow: 0 4px 14px rgba(230,201,122,0.3);
  }
  .na-btn-primary:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(230,201,122,0.4); }
  .na-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .na-btn-outline {
    padding: 11px 20px; background: transparent; color: var(--text-secondary);
    border: 1px solid var(--border); border-radius: var(--radius);
    font-family: var(--font-mono); font-size: 12px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .na-btn-outline:hover:not(:disabled) { border-color: var(--text-secondary); color: var(--text-primary); }
  .na-btn-outline:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Field error */
  .na-field-error {
    font-family: var(--font-mono); font-size: 11px; color: var(--red);
    margin-top: 6px; letter-spacing: 0.04em;
  }

  /* Error banner */
  .na-error-banner {
    margin-bottom: 24px; padding: 14px 16px;
    background: rgba(248,81,73,0.1); border: 1px solid rgba(248,81,73,0.3);
    border-radius: var(--radius);
  }
  .na-error-banner-top {
    display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
    font-family: var(--font-mono); font-size: 11px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--red);
  }
  .na-error-msg { font-size: 13px; color: var(--red); margin: 0; opacity: 0.85; }

  /* Progress */
  .na-progress-wrap {
    margin: 16px 0 4px; padding: 12px 14px;
    background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius);
  }
  .na-progress-label {
    font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--accent); margin-bottom: 8px; display: block;
  }
  .na-progress-track { height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; }
  .na-progress-fill { height: 100%; background: var(--accent); width: 30%; transition: width 0.3s; animation: na-progress-anim 1.4s ease-in-out infinite; }
  @keyframes na-progress-anim { 0% { width: 20%; } 50% { width: 70%; } 100% { width: 20%; } }

  /* Preview card */
  .na-preview-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 24px;
    position: sticky; top: 24px; box-shadow: var(--shadow);
    border-top: 2px solid var(--accent);
  }
  .na-preview-title {
    font-family: var(--font-display); font-size: 18px; font-weight: 600;
    color: var(--text-primary); margin: 0 0 20px;
    padding-bottom: 14px; border-bottom: 1px solid var(--border);
  }
  .na-preview-item { display: flex; gap: 12px; margin-bottom: 14px; font-size: 13px; line-height: 1.5; }
  .na-preview-label {
    font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--text-muted); font-weight: 700;
    width: 80px; flex-shrink: 0; padding-top: 2px;
  }
  .na-preview-value { color: var(--text-secondary); word-break: break-word; }
  .na-no-groups { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }

  @media (max-width: 900px) {
    .na-page-title { font-size: 28px; }
    .na-layout { grid-template-columns: 1fr; }
    .na-form-card { padding: 24px 20px; }
    .na-preview-card { position: static; }
  }
  @media (max-width: 600px) {
    .na-container { padding: 20px 14px 60px; }
    .na-page-title { font-size: 24px; }
    .na-actions { flex-direction: column-reverse; }
    .na-btn-primary, .na-btn-outline { width: 100%; text-align: center; }
  }
`;

// ── Preview component ─────────────────────────────────────────────────────────

interface AssignmentPreviewProps {
  subjectName?: string;
  title: string;
  year?: AcademicYear | "";
  languages: string[];
  targetingSummary: string;
  deadline?: string;
  allowLate: boolean;
}

function AssignmentPreview({ subjectName, title, year, languages, targetingSummary, deadline, allowLate }: AssignmentPreviewProps) {
  const formatDeadline = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };
  return (
    <div className="na-preview-card">
      <h3 className="na-preview-title">Preview</h3>
      {[
        { label: "Subject",  value: subjectName || "—" },
        { label: "Title",    value: title || "—" },
        { label: "Year",     value: year || "—" },
        { label: "Langs",    value: languages.length ? languages.join(", ") : "—" },
        { label: "Target",   value: targetingSummary || "—" },
        { label: "Deadline", value: formatDeadline(deadline) },
        { label: "Late",     value: allowLate ? "Allowed" : "Not allowed" },
      ].map(({ label, value }) => (
        <div className="na-preview-item" key={label}>
          <span className="na-preview-label">{label}</span>
          <span className="na-preview-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Chip component ────────────────────────────────────────────────────────────

function Chip({ label, selected, onClick, disabled }: { label: string; selected: boolean; onClick: () => void; disabled?: boolean }) {
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

// ── Main form ─────────────────────────────────────────────────────────────────

function NewAssignmentForm() {
  const router = useRouter();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "na-dark-styles";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id;
      tag.textContent = PAGE_CSS;
      document.head.appendChild(tag);
    }
  }, []);

  const [subject,           setSubject]           = useState("");
  const [title,             setTitle]             = useState("");
  const [description,       setDescription]       = useState("");
  const [year,              setYear]              = useState<AcademicYear | "">("");
  const [languages,         setLanguages]         = useState<string[]>([]);
  const [targetSections,    setTargetSections]    = useState<string[]>([]);
  const [targetSubSections, setTargetSubSections] = useState<string[]>([]);
  const [targetGroups,      setTargetGroups]      = useState<number[]>([]);
  const [deadline,          setDeadline]          = useState("");
  const [allowLate,         setAllowLate]         = useState(false);

  const [subjects,        setSubjects]        = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [submitting,      setSubmitting]      = useState(false);
  const [errors,          setErrors]          = useState<FormErrors>({});
  const [submitError,     setSubmitError]     = useState<string | null>(null);

  useEffect(() => {
    listSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]))
      .finally(() => setLoadingSubjects(false));
  }, []);

  const isSpecialityYear   = year === "2CS" || year === "3CS";
  const availableSections  = year ? SECTIONS_BY_YEAR[year as AcademicYear] : [];
  const availableGroups    = getAvailableGroups(year, targetSections, targetSubSections);
  const showGroups         = (!isSpecialityYear && targetSections.length > 0) || (isSpecialityYear && targetSubSections.length > 0);

  const handleSectionChange = (section: string) => {
    const removing = targetSections.includes(section);
    const next = removing ? targetSections.filter((s) => s !== section) : [...targetSections, section];
    setTargetSections(next);
    if (removing && isSpecialityYear) {
      setTargetSubSections((prev) => prev.filter((k) => !k.startsWith(section + "-")));
      setTargetGroups((prev) => {
        const remainingSubs = targetSubSections.filter((k) => !k.startsWith(section + "-"));
        const reachable = new Set(remainingSubs.flatMap((k) => SUBSECTION_GROUPS[k.split("-")[1]] ?? []));
        return prev.filter((g) => reachable.has(g));
      });
    } else if (removing && year) {
      const idx = SECTIONS_BY_YEAR[year as AcademicYear].indexOf(section);
      setTargetGroups((prev) => prev.filter((g) => !getGroupsForSection(idx).includes(g)));
    }
  };

  const handleSubSectionChange = (key: string) => {
    const removing = targetSubSections.includes(key);
    const next = removing ? targetSubSections.filter((k) => k !== key) : [...targetSubSections, key];
    setTargetSubSections(next);
    if (removing) {
      const sub = key.split("-")[1];
      const candidates = new Set(SUBSECTION_GROUPS[sub] ?? []);
      const stillReachable = new Set(next.flatMap((k) => SUBSECTION_GROUPS[k.split("-")[1]] ?? []));
      setTargetGroups((prev) => prev.filter((g) => !candidates.has(g) || stillReachable.has(g)));
    }
  };

  const handleGroupChange  = (group: number) => setTargetGroups((prev) => prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]);
  const handleLanguageToggle = (lang: string) => {
    setLanguages((prev) => prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]);
    setErrors((prev) => ({ ...prev, languages: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const validationErrors = validate({ subject, title, year, languages, deadline });
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }
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
        target_groups:   targetGroups.length > 0 ? targetGroups : undefined,
        deadline: new Date(deadline).toISOString(),
        allow_late: allowLate,
      });
      router.push(`/assignments/${assignment.id}`);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
      <Header activePage="Assignments" />
      <div className="na-container">
        {/* Breadcrumb */}
        <nav className="na-breadcrumb">
          <Link href="/" className="na-breadcrumb-link">~/home</Link>
          <span>/</span>
          <Link href="/assignments" className="na-breadcrumb-link">assignments</Link>
          <span>/</span>
          <span>new</span>
        </nav>

        {/* Page header */}
        <div className="na-page-header">
          <div>
            <h1 className="na-page-title">New <span>Assignment</span></h1>
            <p className="na-page-subtitle">Define targeting, languages, and deadlines</p>
          </div>
        </div>

        {/* Layout */}
        <div className="na-layout">
          {/* Form */}
          <form className="na-form-card" onSubmit={handleSubmit}>
            <p className="na-form-section-title">Assignment Details</p>

            {submitError && (
              <div className="na-error-banner">
                <div className="na-error-banner-top"><span>⚠</span><span>Error</span></div>
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
                <option value="">{loadingSubjects ? "Loading subjects…" : "Select a subject"}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.code} — {s.name}</option>
                ))}
              </select>
              {errors.subject && <div className="na-field-error">{errors.subject}</div>}
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
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                disabled={submitting}
              />
            </Field>

            <Field label="Languages" required>
              <div className="na-chip-group">
                {ASSIGNMENT_LANGUAGES.map((lang) => (
                  <Chip key={lang} label={lang} selected={languages.includes(lang)} onClick={() => handleLanguageToggle(lang)} disabled={submitting} />
                ))}
              </div>
              {errors.languages && <div className="na-field-error">{errors.languages}</div>}
            </Field>

            <hr className="na-divider" />
            <p className="na-form-section-title">Targeting</p>

            <Field label="Year" required>
              <div className="na-chip-group">
                {ACADEMIC_YEARS.map((y) => (
                  <Chip
                    key={y} label={y} selected={year === y}
                    onClick={() => {
                      setYear(year === y ? "" : y);
                      setTargetSections([]); setTargetSubSections([]); setTargetGroups([]);
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
                <Field label={isSpecialityYear ? "Speciality" : "Section"} hint="Optional — leave empty for all">
                  <div className="na-chip-group">
                    {availableSections.map((s) => (
                      <Chip key={s} label={s} selected={targetSections.includes(s)} onClick={() => handleSectionChange(s)} disabled={submitting} />
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
                            return <Chip key={key} label={sub} selected={targetSubSections.includes(key)} onClick={() => handleSubSectionChange(key)} disabled={submitting} />;
                          })}
                        </div>
                      </div>
                    ))}
                  </Field>
                )}

                {showGroups && (
                  <Field label="Groups" hint={`Optional — ${isSpecialityYear ? "2 per section" : "4 per section"}`}>
                    {availableGroups.length === 0 ? (
                      <p className="na-no-groups">Select a section to reveal groups.</p>
                    ) : (
                      <div className="na-chip-group">
                        {availableGroups.map((g) => (
                          <Chip key={g} label={String(g)} selected={targetGroups.includes(g)} onClick={() => handleGroupChange(g)} disabled={submitting} />
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
              {errors.deadline && <div className="na-field-error">{errors.deadline}</div>}
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

            {submitting && (
              <div className="na-progress-wrap">
                <span className="na-progress-label">Creating assignment…</span>
                <div className="na-progress-track"><div className="na-progress-fill" /></div>
              </div>
            )}

            <div className="na-actions">
              <button type="button" className="na-btn-outline" disabled={submitting} onClick={() => router.back()}>
                Cancel
              </button>
              <button type="submit" className="na-btn-primary" disabled={submitting}>
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
