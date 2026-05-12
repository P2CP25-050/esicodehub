"use client";
import { useState, useEffect, ChangeEvent, DragEvent, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Header from "@/components/submissions/Header";
import Field from "@/components/submissions/Field";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { listSubjects, createAssignment, uploadAssignmentDescriptionPdf } from "@/services/assignments";
import type { Subject } from "@/services/assignments";
import { SUPPORTED_LANGUAGES } from "@/services/submissions/submissions.types";
import Head from "next/head";

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
const ASSIGNMENT_LANGUAGES: string[] = [
  ...SUPPORTED_LANGUAGES,
  "SQL",
  "Bash",
  "R",
];

const ASSIGNMENT_TYPES = ["lab", "project", "homework", "exam", "quiz", "report"];

const PREVIEW_ICONS: Record<string, string> = {
  subject: "SB",
  year: "YR",
  target: "TG",
  deadline: "DL",
  late: "LT",
};

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
  if (!fields.year) errors.year = "Please select a year";
  if (!fields.languages.length) errors.languages = "Please select at least one language";
  if (!fields.type) errors.type = "Assignment type is required.";
  if (!fields.deadline) errors.deadline = "Deadline is required.";
  else if (new Date(fields.deadline) <= new Date()) errors.deadline = "Deadline must be in the future.";
  return errors;
}

function formatAssignmentTypeLabel(value: string): string {
  if (!value) return "Assignment type";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDeadlineLabel(value: string): string {
  if (!value) return "No deadline set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatDeadlineMeta(value: string): string {
  if (!value) return "Students will see the due date here.";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Check the deadline format.";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

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

  .na-language-caption {
    margin-top: 10px;
    font-size: 12px;
    color: #5b6b88;
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
  .na-btn-outline {
    padding: 11px 20px; background: transparent; border: var(--rule);
    font-family: var(--font-mono); font-size: 11px; font-weight: 700;
    text-transform: uppercase; cursor: pointer;
  }
  .na-btn-outline:hover { box-shadow: 2px 2px 0 var(--ink); }
  .na-field-error {
    font-family: var(--font-mono);
    font-size: 11px;
    color: #b42318;
    margin-top: 6px;
  }
  .na-error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding: 14px 18px;
    background: #fff3f2;
    border: 1.5px solid #f04438;
    border-left: 5px solid #f04438;
    color: #b42318;
  }
  .na-progress-wrap {
    margin: 16px 0 4px;
    padding: 12px 14px;
    background: #f8fbff;
    border: 1px solid #dbe7ff;
  }
  .na-progress-label {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    color: var(--navy);
    margin-bottom: 8px;
    display: inline-block;
  }
  .na-progress-track { height: 3px; background: #dbe7ff; }
  .na-progress-fill { height: 100%; background: var(--navy); animation: ap-progress 1.4s ease-in-out infinite; }
  @keyframes ap-progress { 0% { width: 20%; } 50% { width: 70%; } 100% { width: 20%; } }
  .na-preview-card {
    position: sticky;
    top: 24px;
    overflow: hidden;
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.45);
    background:
      radial-gradient(circle at top right, rgba(96, 165, 250, 0.26), transparent 34%),
      linear-gradient(180deg, #0f3b91 0%, #0a235d 100%);
    color: #f8fbff;
    box-shadow: 0 24px 60px rgba(5, 22, 80, 0.28);
  }
  .na-preview-inner {
    padding: 26px;
    backdrop-filter: blur(12px);
  }
  .na-preview-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .na-preview-title {
    margin: 18px 0 8px;
    font-family: var(--font-display);
    font-size: 30px;
    line-height: 1.05;
    color: #ffffff;
  }
  .na-preview-subtitle {
    margin: 0;
    color: rgba(232, 241, 255, 0.84);
    font-size: 14px;
    line-height: 1.6;
  }
  .na-preview-hero {
    margin-top: 22px;
    display: grid;
    gap: 14px;
  }
  .na-preview-highlight {
    padding: 18px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.14);
  }
  .na-preview-highlight-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }
  .na-preview-highlight-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(232, 241, 255, 0.72);
  }
  .na-preview-highlight-value {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #ffffff;
  }
  .na-preview-highlight-meta {
    margin: 2px 0 0;
    font-size: 13px;
    color: rgba(232, 241, 255, 0.76);
  }
  .na-preview-type-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    background: rgba(147, 197, 253, 0.18);
    border: 1px solid rgba(191, 219, 254, 0.24);
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #dbeafe;
  }
  .na-preview-meta-grid {
    margin-top: 22px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .na-preview-mini-card {
    padding: 16px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    min-height: 106px;
  }
  .na-preview-mini-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .na-preview-icon {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.12);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    color: #dbeafe;
    flex-shrink: 0;
  }
  .na-preview-mini-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(232, 241, 255, 0.7);
  }
  .na-preview-mini-value {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.4;
  }
  .na-preview-mini-detail {
    margin: 6px 0 0;
    font-size: 13px;
    color: rgba(232, 241, 255, 0.72);
    line-height: 1.5;
  }
  .na-preview-divider {
    margin: 22px 0 18px;
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.14);
  }
  .na-preview-section-heading {
    margin: 0 0 12px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(232, 241, 255, 0.68);
  }
  .na-preview-language-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .na-preview-language-pill {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .na-preview-language-pill.empty {
    color: rgba(232, 241, 255, 0.7);
  }
  @media (max-width: 1024px) {
    .na-layout { grid-template-columns: 1fr; }
    .na-preview-card {
      position: static;
      order: -1;
    }
  }
  @media (max-width: 900px) {
    .na-page-title { font-size: 30px; }
    .na-page::before { display: none; }
  }
  @media (max-width: 640px) {
    .na-container {
      padding: 28px 18px 56px;
    }
    .na-form-card {
      padding: 24px 18px;
    }
    .na-preview-inner {
      padding: 20px;
    }
    .na-preview-title {
      font-size: 24px;
    }
    .na-preview-meta-grid {
      grid-template-columns: 1fr;
    }
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
  subjectName: string | undefined;
  title: string;
  year: AcademicYear | "";
  assignmentType: string;
  languages: string[];
  targetingSummary: string;
  deadline: string;
  allowLate: boolean;
}

function AssignmentPreview({ subjectName, title, year, assignmentType, languages, targetingSummary, deadline, allowLate }: AssignmentPreviewProps) {
  const displayTitle = title || "Untitled assignment";
  const displayType = formatAssignmentTypeLabel(assignmentType);
  const displayDeadline = formatDeadlineLabel(deadline);
  const deadlineMeta = formatDeadlineMeta(deadline);

  return (
    <div className="na-preview-card">
      <div className="na-preview-inner">
        <span className="na-preview-eyebrow">Live assignment preview</span>
        <h3 className="na-preview-title">{displayTitle}</h3>
        <p className="na-preview-subtitle">
          {subjectName || "Pick a subject to complete the assignment brief."}
        </p>

        <div className="na-preview-hero">
          <div className="na-preview-highlight">
            <div className="na-preview-highlight-top">
              <span className="na-preview-highlight-label">Deadline</span>
              <span className="na-preview-type-badge">{displayType}</span>
            </div>
            <p className="na-preview-highlight-value">{displayDeadline}</p>
            <p className="na-preview-highlight-meta">{deadlineMeta}</p>
          </div>
        </div>

        <div className="na-preview-meta-grid">
          <div className="na-preview-mini-card">
            <div className="na-preview-mini-top">
              <span className="na-preview-icon">{PREVIEW_ICONS.subject}</span>
              <span className="na-preview-mini-label">Subject</span>
            </div>
            <p className="na-preview-mini-value">{subjectName || "Not selected"}</p>
            <p className="na-preview-mini-detail">{year || "Choose a year"}</p>
          </div>

          <div className="na-preview-mini-card">
            <div className="na-preview-mini-top">
              <span className="na-preview-icon">{PREVIEW_ICONS.target}</span>
              <span className="na-preview-mini-label">Target</span>
            </div>
            <p className="na-preview-mini-value">{targetingSummary || "Targeting not set"}</p>
            <p className="na-preview-mini-detail">{allowLate ? "Late submission enabled" : "Late submission disabled"}</p>
          </div>

          <div className="na-preview-mini-card">
            <div className="na-preview-mini-top">
              <span className="na-preview-icon">{PREVIEW_ICONS.year}</span>
              <span className="na-preview-mini-label">Year</span>
            </div>
            <p className="na-preview-mini-value">{year || "Not selected"}</p>
            <p className="na-preview-mini-detail">Assignment type: {displayType}</p>
          </div>

          <div className="na-preview-mini-card">
            <div className="na-preview-mini-top">
              <span className="na-preview-icon">{PREVIEW_ICONS.late}</span>
              <span className="na-preview-mini-label">Late Submission</span>
            </div>
            <p className="na-preview-mini-value">{allowLate ? "Allowed" : "Blocked"}</p>
            <p className="na-preview-mini-detail">{allowLate ? "Students can still upload after the due date." : "Students must submit before the deadline."}</p>
          </div>
        </div>

        <hr className="na-preview-divider" />

        <div>
          <p className="na-preview-section-heading">Programming language</p>
          <div className="na-preview-language-list">
            {languages.length > 0 ? (
              languages.map(language => (
                <span key={language} className="na-preview-language-pill">{language}</span>
              ))
            ) : (
              <span className="na-preview-language-pill empty">No language selected</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
}

function Chip({ label, selected, onClick, disabled }: ChipProps) {
  const chipClassName = selected
    ? "px-3 py-1.5 rounded-full border border-blue-600 bg-blue-600 text-sm font-medium text-white transition-all duration-150 cursor-pointer"
    : "px-3 py-1.5 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-600 transition-all duration-150 cursor-pointer";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={chipClassName}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

function NewAssignmentForm() {
  const router = useRouter();
const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "ap-new-styles";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id; 
      tag.textContent = PAGE_CSS;
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
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    listSubjects().then(setSubjects).catch(() => setSubjects([])).finally(() => setLoadingSubjects(false));
  }, []);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const setPdfFile = (file: File) => {
    if (!isPdfFile(file)) {
      setSubmitError('Please upload a PDF file.');
      return;
    }
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

      // Upload PDF if selected
      if (selectedPdf) {
        await uploadAssignmentDescriptionPdf(assignment.id, selectedPdf);
      }

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
    <div className="na-page">
      <Head>
        <title>Create Assignment — ESICodeHub</title>
        <style id="na-ink-styles">{PAGE_CSS}</style>
      </Head>
      <Header activePage="Assignments" />
      <div className="na-container">
        <nav className="na-breadcrumb">
          <Link href="/" className="na-breadcrumb-link">~/home</Link>
          <span className="na-breadcrumb-sep">/</span>
          <Link href="/assignments" className="na-breadcrumb-link">assignments</Link>
          <span className="na-breadcrumb-sep">/</span>
          <span>new</span>
        </nav>

        <div className="na-page-header">
          <div>
            <h1 className="na-page-title">New <span>Assignment</span></h1>
            <p className="na-page-subtitle">Define targeting, languages, and deadlines</p>
          </div>
        </div>

        <div className="na-layout">
          <form className="na-form-card" onSubmit={handleSubmit}>
            <p className="na-form-section-title">Assignment Details</p>
            {submitError && <div className="na-error-banner"><span>⚠ {submitError}</span></div>}

            <Field label="Subject" required>
              <select className="na-select" value={subject} onChange={e => { setSubject(e.target.value); setErrors(prev => ({ ...prev, subject: undefined })); }} disabled={loadingSubjects || submitting}>
                <option value="">{loadingSubjects ? "Loading subjects…" : "Select a subject"}</option>
                {subjects.map(s => <option key={s.id} value={String(s.id)}>{s.code} — {s.name}</option>)}
              </select>
              {errors.subject && <div className="na-field-error">{errors.subject}</div>}
            </Field>

            <Field label="Title" required>
              <input className="na-input" placeholder="e.g. Lab Report 3 — Binary Trees" value={title} onChange={e => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: undefined })); }} disabled={submitting} />
              {errors.title && <div className="na-field-error">{errors.title}</div>}
            </Field>

            <Field label="Description" hint="Optional — instructions or context">
              <textarea className="na-textarea" placeholder="Describe the assignment..." value={description} onChange={e => setDescription(e.target.value)} disabled={submitting} />
            </Field>

            <Field label="Assignment Type" required>
              <div className="na-chip-group">
                {ASSIGNMENT_TYPES.map(t => <Chip key={t} label={t} selected={assignmentType === t} onClick={() => { setAssignmentType(prev => prev === t ? "" : t); setErrors(prev => ({ ...prev, type: undefined })); }} disabled={submitting} />)}
              </div>
              {errors.type && <div className="na-field-error">{errors.type}</div>}
            </Field>

            <Field label="Languages" required>
              <select
                className="na-select"
                value={languages[0] ?? ""}
                onChange={e => {
                  const value = e.target.value;
                  setLanguages(value ? [value] : []);
                  setErrors(prev => ({ ...prev, languages: undefined }));
                }}
                disabled={submitting}
              >
                <option value="">Select a language</option>
                {ASSIGNMENT_LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
              <p className="na-language-caption">Select one language only. Options appear when you open the field, like Subject.</p>
              {errors.languages && <div className="na-field-error">{errors.languages}</div>}
            </Field>

            <hr className="na-divider" />
            <p className="na-form-section-title">Targeting</p>

            <Field label="Year" required>
              <div className="na-chip-group">
                {ACADEMIC_YEARS.map(y => <Chip key={y} label={y} selected={year === y} onClick={() => { setYear(year === y ? "" : y); setTargetSections([]); setTargetSubSections([]); setTargetGroups([]); setErrors(prev => ({ ...prev, year: undefined })); }} disabled={submitting} />)}
              </div>
              {errors.year && <div className="na-field-error">{errors.year}</div>}
            </Field>

            {year && (
              <>
                <Field label={isSpecialityYear ? "Speciality" : "Section"} hint={isSpecialityYear ? "Optional — leave empty for all sections" : "Optional — leave empty for all"}>
                  <div className="na-chip-group">
                    {availableSections.map(s => <Chip key={s} label={s} selected={targetSections.includes(s)} onClick={() => handleSectionChange(s)} disabled={submitting} />)}
                  </div>
                </Field>

                {isSpecialityYear && targetSections.length > 0 && (
                  <Field label="Section" hint="Optional — 2 per speciality">
                    {targetSections.map(spec => (
                      <div key={spec} className="na-subsection-row">
                        <span className="na-subsection-label">{spec}</span>
                        <div className="na-chip-group">
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
                    {availableGroups.length === 0 ? <p className="na-field-error">Select a section to reveal groups.</p> : (
                      <div className="na-chip-group">
                        {availableGroups.map(g => <Chip key={g} label={String(g)} selected={targetGroups.includes(g)} onClick={() => setTargetGroups(prev => prev.includes(g) ? prev.filter(p => p !== g) : [...prev, g])} disabled={submitting} />)}
                      </div>
                    )}
                  </Field>
                )}
              </>
            )}

            <hr className="na-divider" />
            <p className="na-form-section-title">Submission Settings</p>

            <Field label="Deadline" required>
              <input type="datetime-local" className="na-input" value={deadline} onChange={e => { setDeadline(e.target.value); setErrors(prev => ({ ...prev, deadline: undefined })); }} disabled={submitting} />
              {errors.deadline && <div className="na-field-error">{errors.deadline}</div>}
            </Field>

            <Field label="Late submissions">
              <div className="na-toggle-row">
                <input type="checkbox" id="allowLate" checked={allowLate} onChange={e => setAllowLate(e.target.checked)} disabled={submitting} className="na-checkbox" />
                <label htmlFor="allowLate" className="na-toggle-label">Allow students to submit after the deadline</label>
              </div>
            </Field>

            <Field label="PDF Description" hint="Optional — upload PDF instructions for students">
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
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={openFileDialog}
                  className={`na-pdf-dropzone${dragOver ? ' drag-over' : ''}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openFileDialog();
                    }
                  }}
                >
                  <p className="na-pdf-helper-title">
                    Drag and drop PDF or click to browse
                  </p>
                  <p className="na-pdf-helper-subtitle">
                    Optional PDF with assignment details
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
            </Field>

            {/* Progress */}
            {submitting && (
              <div className="na-progress-wrap">
                <span className="na-progress-label">Creating assignment…</span>
                <div className="na-progress-track"><div className="na-progress-fill" /></div>
              </div>
            )}

            <div className="na-actions">
              <button type="button" className="na-btn-outline" disabled={submitting} onClick={() => router.back()}>Cancel</button>
              <button type="submit" className="na-btn-primary" disabled={submitting}>{submitting ? "Creating…" : "+ Create Assignment"}</button>
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
