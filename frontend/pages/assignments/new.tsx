"use client";
import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Header from "@/components/submissions/Header";
import Field from "@/components/submissions/Field";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { listSubjects, createAssignment } from "@/services/assignments";
import type { Subject } from "@/services/assignments";

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
const SUBSECTION_GROUPS: Record<string, number[]> = { A: [1, 2], B: [3, 4] };
const ASSIGNMENT_LANGUAGES = [
  "python", "c", "c++", "java", "javascript", "typescript",
  "rust", "go", "kotlin", "swift", "r", "matlab",
  "scala", "haskell", "prolog", "sql", "bash", "php",
  "ruby", "dart",
];

const ASSIGNMENT_TYPES = ["lab", "project", "homework", "exam", "quiz", "report"];

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
    return selectedSections.flatMap(s => {
      const idx = sections.indexOf(s);
      return idx >= 0 ? getGroupsForSection(idx) : [];
    });
  }
  const seen = new Set<number>();
  selectedSubSections.forEach(key => {
    const sub = key.split("-")[1];
    SUBSECTION_GROUPS[sub]?.forEach(g => seen.add(g));
  });
  return Array.from(seen).sort();
}

interface FormErrors {
  subject?: string; title?: string; year?: string; languages?: string; deadline?: string; type?: string;
}
function validate(fields: { subject: string; title: string; year: string; languages: string[]; deadline: string; type: string }): FormErrors {
  const errors: FormErrors = {};
  if (!fields.subject) errors.subject = "Subject is required.";
  if (!fields.title.trim()) errors.title = "Title is required.";
  if (!fields.year) errors.year = "Year is required.";
  if (!fields.languages.length) errors.languages = "Select at least one language.";
  if (!fields.type) errors.type = "Assignment type is required.";
  if (!fields.deadline) errors.deadline = "Deadline is required.";
  else if (new Date(fields.deadline) <= new Date()) errors.deadline = "Deadline must be in the future.";
  return errors;
}

const PAGE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
  :root {
    --ink: #000000; --paper: #ffffff; --navy: #051650;
    --rule: 1.5px solid #000; --surface: #f7f7f5; --surface-2: #f0efec;
    --border-soft: #e0e0e0; --text-sub: #444444; --text-muted: #666666;
    --red: #cc0000; --green: #1a7a3c; --orange: #b85c00;
    --font-display: 'Playfair Display', serif; --font-mono: 'Space Mono', monospace; --font-body: 'DM Sans', sans-serif;
  }
  .ap-page {
    min-height: 100vh; background: var(--paper); font-family: var(--font-body); color: var(--ink); position: relative;
  }
  .ap-page::before {
    content: ''; position: fixed; top: 0; right: 0;
    width: 280px; height: 100vh; background: var(--navy);
    clip-path: polygon(80px 0, 100% 0, 100% 100%, 0 100%); z-index: 0; pointer-events: none;
  }
  .ap-container {
    max-width: 1200px; margin: 0 auto; padding: 40px 28px 80px; position: relative; z-index: 1;
  }
  .ap-breadcrumb {
    display: flex; align-items: center; gap: 10px; margin-bottom: 36px;
    font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted);
  }
  .ap-breadcrumb-link {
    color: var(--navy); font-weight: 700; text-decoration: none;
    border-bottom: 1.5px solid var(--navy); padding-bottom: 1px; transition: opacity 0.15s;
  }
  .ap-breadcrumb-link:hover { opacity: 0.65; }
  .ap-breadcrumb-sep { color: #aaa; }
  .ap-page-header {
    display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between;
    gap: 16px; padding-bottom: 28px; border-bottom: var(--rule); margin-bottom: 32px;
  }
  .ap-page-title {
    font-family: var(--font-display); font-size: 40px; font-weight: 900; color: var(--ink);
    margin: 0 0 6px; line-height: 1.05; letter-spacing: -0.02em;
  }
  .ap-page-title span { color: var(--navy); }
  .ap-page-subtitle {
    font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin: 0;
  }
  .ap-layout { display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: start; }
  .ap-form-card {
    background: var(--surface); border: var(--rule); padding: 32px;
  }
  .ap-form-section-title {
    font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--text-muted); margin: 0 0 20px;
    padding-bottom: 10px; border-bottom: 1px solid var(--border-soft);
  }
  .ap-divider { margin: 24px 0; border: none; border-top: 1px solid var(--border-soft); }
  .ap-input, .ap-select, .ap-textarea {
    width: 100%; padding: 10px 14px; background: var(--paper); border: var(--rule);
    color: var(--ink); font-family: var(--font-body); font-size: 13px; outline: none;
    transition: box-shadow 0.15s;
  }
  .ap-input:focus, .ap-select:focus, .ap-textarea:focus {
    box-shadow: 3px 3px 0 var(--navy); border-color: var(--navy);
  }
  .ap-select { appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23000' stroke-width='1.5' fill='none'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; }
  .ap-textarea { min-height: 100px; resize: vertical; }
  .ap-chip-group { display: flex; flex-wrap: wrap; gap: 8px; }
  .ap-chip {
    padding: 6px 14px; background: var(--paper); border: var(--rule);
    color: var(--text-sub); font-family: var(--font-mono); font-size: 11px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.12s;
  }
  .ap-chip:hover { background: var(--surface-2); box-shadow: 2px 2px 0 var(--navy); }
  .ap-chip.selected { background: var(--navy); border-color: var(--navy); color: var(--paper); }
  .ap-chip:disabled { opacity: 0.4; cursor: not-allowed; }
  .ap-subsection-row { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
  .ap-subsection-label {
    font-family: var(--font-mono); font-size: 11px; font-weight: 700;
    color: var(--navy); letter-spacing: 0.1em; text-transform: uppercase; min-width: 50px;
  }
  .ap-toggle-row { display: flex; align-items: center; gap: 10px; }
  .ap-checkbox { width: 16px; height: 16px; cursor: pointer; accent-color: var(--navy); }
  .ap-actions {
    display: flex; gap: 12px; justify-content: flex-end;
    margin-top: 28px; padding-top: 24px; border-top: var(--rule);
  }
  .btn-primary {
    padding: 11px 28px; background: var(--navy); color: var(--paper);
    border: 1.5px solid var(--navy); font-family: var(--font-mono); font-size: 11px;
    font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
    transition: background 0.15s, box-shadow 0.12s, transform 0.1s;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--ink); border-color: var(--ink); box-shadow: 4px 4px 0 var(--navy);
    transform: translate(-2px, -2px);
  }
  .btn-outline {
    padding: 11px 20px; background: transparent; border: var(--rule);
    font-family: var(--font-mono); font-size: 11px; font-weight: 700;
    text-transform: uppercase; cursor: pointer;
  }
  .btn-outline:hover { box-shadow: 2px 2px 0 var(--ink); }
  .ap-field-error {
    font-family: var(--font-mono); font-size: 11px; color: var(--red); margin-top: 6px;
  }
  .ap-error-banner {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 24px; padding: 14px 18px; background: #fff0f0;
    border: 1.5px solid var(--red); border-left: 5px solid var(--red); color: var(--red);
  }
  .ap-progress-wrap { margin: 16px 0 4px; padding: 12px 14px; background: var(--surface-2); border: 1px solid var(--border-soft); }
  .ap-progress-label { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; color: var(--navy); margin-bottom: 8px; }
  .ap-progress-track { height: 3px; background: var(--border-soft); }
  .ap-progress-fill { height: 100%; background: var(--navy); animation: ap-progress 1.4s ease-in-out infinite; }
  @keyframes ap-progress { 0% { width: 20%; } 50% { width: 70%; } 100% { width: 20%; } }
  .ap-preview-card {
    background: var(--surface); border: var(--rule); border-top: 4px solid var(--navy);
    padding: 24px; position: sticky; top: 24px;
  }
  .ap-preview-title {
    font-family: var(--font-display); font-size: 18px; font-weight: 700;
    color: var(--ink); margin: 0 0 20px; padding-bottom: 14px; border-bottom: var(--rule);
  }
  .ap-preview-item { display: flex; gap: 12px; margin-bottom: 14px; font-size: 13px; line-height: 1.5; }
  .ap-preview-label {
    font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--text-muted); font-weight: 700; width: 80px;
  }
  @media (max-width: 900px) {
    .ap-layout { grid-template-columns: 1fr; }
    .ap-page-title { font-size: 30px; }
    .ap-page::before { display: none; }
  }
`;

function AssignmentPreview({ subjectName, title, year, assignmentType, languages, targetingSummary, deadline, allowLate }: any) {
  return (
    <div className="ap-preview-card">
      <h3 className="ap-preview-title">Preview</h3>
      <div className="ap-preview-item"><span className="ap-preview-label">Subject</span><span>{subjectName || "—"}</span></div>
      <div className="ap-preview-item"><span className="ap-preview-label">Title</span><span>{title || "—"}</span></div>
      <div className="ap-preview-item"><span className="ap-preview-label">Year</span><span>{year || "—"}</span></div>
      <div className="ap-preview-item"><span className="ap-preview-label">Type</span><span>{assignmentType || "—"}</span></div>
      <div className="ap-preview-item"><span className="ap-preview-label">Langs</span><span>{languages.length ? languages.join(", ") : "—"}</span></div>
      <div className="ap-preview-item"><span className="ap-preview-label">Target</span><span>{targetingSummary || "—"}</span></div>
      <div className="ap-preview-item"><span className="ap-preview-label">Deadline</span><span>{deadline ? new Date(deadline).toLocaleString() : "—"}</span></div>
      <div className="ap-preview-item"><span className="ap-preview-label">Late</span><span>{allowLate ? "Allowed" : "Not allowed"}</span></div>
    </div>
  );
}

function Chip({ label, selected, onClick, disabled }: any) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`ap-chip ${selected ? "selected" : ""}`}>
      {label}
    </button>
  );
}

function NewAssignmentForm() {
  const router = useRouter();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "ap-new-styles";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id; tag.textContent = PAGE_CSS;
      document.head.appendChild(tag);
    }
  }, []);

  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [year, setYear] = useState<AcademicYear | "">("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [assignmentType, setAssignmentType] = useState<string>("");
  const [targetSections, setTargetSections] = useState<string[]>([]);
  const [targetSubSections, setTargetSubSections] = useState<string[]>([]);
  const [targetGroups, setTargetGroups] = useState<number[]>([]);
  const [deadline, setDeadline] = useState("");
  const [allowLate, setAllowLate] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    listSubjects().then(setSubjects).catch(() => setSubjects([])).finally(() => setLoadingSubjects(false));
  }, []);

  const isSpecialityYear = year === "2CS" || year === "3CS";
  const availableSections = year ? SECTIONS_BY_YEAR[year as AcademicYear] : [];
  const availableGroups = getAvailableGroups(year, targetSections, targetSubSections);
  const showGroups = (!isSpecialityYear && targetSections.length > 0) || (isSpecialityYear && targetSubSections.length > 0);

  const handleSectionChange = (section: string) => {
    const removing = targetSections.includes(section);
    setTargetSections(removing ? targetSections.filter(s => s !== section) : [...targetSections, section]);
    if (removing && isSpecialityYear) {
      setTargetSubSections(prev => prev.filter(k => !k.startsWith(section + "-")));
    } else if (removing && year) {
      const idx = SECTIONS_BY_YEAR[year as AcademicYear].indexOf(section);
      setTargetGroups(prev => prev.filter(g => !getGroupsForSection(idx).includes(g)));
    }
  };

  const handleSubSectionChange = (key: string) => {
    const removing = targetSubSections.includes(key);
    setTargetSubSections(removing ? targetSubSections.filter(k => k !== key) : [...targetSubSections, key]);
    if (removing) {
      const sub = key.split("-")[1];
      const candidates = new Set(SUBSECTION_GROUPS[sub] ?? []);
      const stillReachable = new Set(targetSubSections.filter(k => k !== key).flatMap(k => SUBSECTION_GROUPS[k.split("-")[1]] ?? []));
      setTargetGroups(prev => prev.filter(g => !candidates.has(g) || stillReachable.has(g)));
    }
  };

  const handleLanguageToggle = (lang: string) => {
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
    setErrors(prev => ({ ...prev, languages: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const validationErrors = validate({ subject, title, year, languages, deadline, type: assignmentType });
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
        target_sections: targetSections.length ? targetSections : undefined,
        target_groups: targetGroups.length ? targetGroups : undefined,
        deadline: new Date(deadline).toISOString(),
        allow_late: allowLate,
      });
      router.push(`/assignments/${assignment.id}`);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  const targetingSummary = () => {
    if (!year) return "No year selected";
    if (isSpecialityYear) {
      if (targetSubSections.length === 0) return "All specialities";
      return targetSubSections.map(k => k.replace("-", " ")).join(", ");
    }
    if (targetSections.length === 0) return "All sections";
    if (targetGroups.length === 0) return `Sections: ${targetSections.join(", ")}`;
    return `Sections: ${targetSections.join(", ")} (Groups: ${targetGroups.join(", ")})`;
  };

  const selectedSubjectName = subjects.find(s => String(s.id) === subject)?.name;

  return (
    <div className="ap-page">
      <Header activePage="Assignments" />
      <div className="ap-container">
        <nav className="ap-breadcrumb">
          <Link href="/" className="ap-breadcrumb-link">~/home</Link>
          <span className="ap-breadcrumb-sep">/</span>
          <Link href="/assignments" className="ap-breadcrumb-link">assignments</Link>
          <span className="ap-breadcrumb-sep">/</span>
          <span>new</span>
        </nav>

        <div className="ap-page-header">
          <div>
            <h1 className="ap-page-title">New <span>Assignment</span></h1>
            <p className="ap-page-subtitle">Define targeting, languages, and deadlines</p>
          </div>
        </div>

        <div className="ap-layout">
          <form className="ap-form-card" onSubmit={handleSubmit}>
            <p className="ap-form-section-title">Assignment Details</p>
            {submitError && <div className="ap-error-banner"><span>⚠ {submitError}</span></div>}

            <Field label="Subject" required>
              <select className="ap-select" value={subject} onChange={e => { setSubject(e.target.value); setErrors(prev => ({ ...prev, subject: undefined })); }} disabled={loadingSubjects || submitting}>
                <option value="">{loadingSubjects ? "Loading subjects…" : "Select a subject"}</option>
                {subjects.map(s => <option key={s.id} value={String(s.id)}>{s.code} — {s.name}</option>)}
              </select>
              {errors.subject && <div className="ap-field-error">{errors.subject}</div>}
            </Field>

            <Field label="Title" required>
              <input className="ap-input" placeholder="e.g. Lab Report 3 — Binary Trees" value={title} onChange={e => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: undefined })); }} disabled={submitting} />
              {errors.title && <div className="ap-field-error">{errors.title}</div>}
            </Field>

            <Field label="Description" hint="Optional — instructions or context">
              <textarea className="ap-textarea" placeholder="Describe the assignment..." value={description} onChange={e => setDescription(e.target.value)} disabled={submitting} />
            </Field>

            <Field label="Assignment Type" required>
              <div className="ap-chip-group">
                {ASSIGNMENT_TYPES.map(t => <Chip key={t} label={t} selected={assignmentType === t} onClick={() => { setAssignmentType(prev => prev === t ? "" : t); setErrors(prev => ({ ...prev, type: undefined })); }} disabled={submitting} />)}
              </div>
              {errors.type && <div className="ap-field-error">{errors.type}</div>}
            </Field>

            <Field label="Languages" required>
              <div className="ap-chip-group">
                {ASSIGNMENT_LANGUAGES.map(lang => <Chip key={lang} label={lang} selected={languages.includes(lang)} onClick={() => handleLanguageToggle(lang)} disabled={submitting} />)}
              </div>
              {errors.languages && <div className="ap-field-error">{errors.languages}</div>}
            </Field>

            <hr className="ap-divider" />
            <p className="ap-form-section-title">Targeting</p>

            <Field label="Year" required>
              <div className="ap-chip-group">
                {ACADEMIC_YEARS.map(y => <Chip key={y} label={y} selected={year === y} onClick={() => { setYear(year === y ? "" : y); setTargetSections([]); setTargetSubSections([]); setTargetGroups([]); setErrors(prev => ({ ...prev, year: undefined })); }} disabled={submitting} />)}
              </div>
              {errors.year && <div className="ap-field-error">{errors.year}</div>}
            </Field>

            {year && (
              <>
                <Field label={isSpecialityYear ? "Speciality" : "Section"} hint="Optional — leave empty for all">
                  <div className="ap-chip-group">
                    {availableSections.map(s => <Chip key={s} label={s} selected={targetSections.includes(s)} onClick={() => handleSectionChange(s)} disabled={submitting} />)}
                  </div>
                </Field>

                {isSpecialityYear && targetSections.length > 0 && (
                  <Field label="Section" hint="Optional — 2 per speciality">
                    {targetSections.map(spec => (
                      <div key={spec} className="ap-subsection-row">
                        <span className="ap-subsection-label">{spec}</span>
                        <div className="ap-chip-group">
                          {SPECIALITY_SUBSECTIONS.map(sub => {
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
                    {availableGroups.length === 0 ? <p className="ap-field-error">Select a section to reveal groups.</p> : (
                      <div className="ap-chip-group">
                        {availableGroups.map(g => <Chip key={g} label={String(g)} selected={targetGroups.includes(g)} onClick={() => setTargetGroups(prev => prev.includes(g) ? prev.filter(p => p !== g) : [...prev, g])} disabled={submitting} />)}
                      </div>
                    )}
                  </Field>
                )}
              </>
            )}

            <hr className="ap-divider" />
            <p className="ap-form-section-title">Submission Settings</p>

            <Field label="Deadline" required>
              <input type="datetime-local" className="ap-input" value={deadline} onChange={e => { setDeadline(e.target.value); setErrors(prev => ({ ...prev, deadline: undefined })); }} disabled={submitting} />
              {errors.deadline && <div className="ap-field-error">{errors.deadline}</div>}
            </Field>

            <Field label="Late submissions">
              <div className="ap-toggle-row">
                <input type="checkbox" id="allowLate" checked={allowLate} onChange={e => setAllowLate(e.target.checked)} disabled={submitting} className="ap-checkbox" />
                <label htmlFor="allowLate" className="ap-toggle-label">Allow students to submit after the deadline</label>
              </div>
            </Field>

            {submitting && (
              <div className="ap-progress-wrap">
                <span className="ap-progress-label">Creating assignment…</span>
                <div className="ap-progress-track"><div className="ap-progress-fill" /></div>
              </div>
            )}

            <div className="ap-actions">
              <button type="button" className="btn-outline" disabled={submitting} onClick={() => router.back()}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Creating…" : "+ Create Assignment"}</button>
            </div>
          </form>

          <AssignmentPreview
            subjectName={selectedSubjectName} title={title} year={year}
            assignmentType={assignmentType} languages={languages} targetingSummary={targetingSummary()}
            deadline={deadline} allowLate={allowLate}
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