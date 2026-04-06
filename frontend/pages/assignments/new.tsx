"use client";
import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/router";
import Header from "@/components/submissions/Header";
import Field from "@/components/submissions/Field";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { listSubjects, createAssignment } from "@/services/assignement/api";
import type { Subject } from "@/services/assignement/types";

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

// ------------------------------------------------------
interface FormErrors {
  subject?: string;
  title?: string;
  year?: string;
  deadline?: string;
}

function validate(
  fields: {
  subject: string;
  title: string;
  year: string;
  deadline: string;
}): FormErrors {
  const errors: FormErrors = {};
  if (!fields.subject) errors.subject = "Subject is required.";
  if (!fields.title.trim()) errors.title = "Title is required.";
  if (!fields.year) errors.year = "Year is required.";
  if (!fields.deadline) errors.deadline = "Deadline is required.";
  else if (new Date(fields.deadline) <= new Date())
    errors.deadline = "Deadline must be in the future.";
  return errors;
}

// Preview 

interface AssignmentPreviewProps {
  subjectName?: string;
  title: string;
  year?: AcademicYear | "";
  targetingSummary: string;
  deadline?: string;
  allowLate: boolean;
}

function AssignmentPreview({
  subjectName,
  title,
  year,
  targetingSummary,
  deadline,
  allowLate,
}: AssignmentPreviewProps) {
  const formatDeadline = (dateStr?: string) => {
    if (!dateStr) return "Not set";
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  return (
    <div style={styles.previewCard}>
      <h3 style={styles.previewTitle}>Assignment Preview</h3>
      <div style={styles.previewItem}>
        <span style={styles.previewLabel}>Subject:</span>
        <span>{subjectName || "—"}</span>
      </div>
      <div style={styles.previewItem}>
        <span style={styles.previewLabel}>Title:</span>
        <span>{title || "—"}</span>
      </div>
      <div style={styles.previewItem}>
        <span style={styles.previewLabel}>Year:</span>
        <span>{year || "—"}</span>
      </div>
      <div style={styles.previewItem}>
        <span style={styles.previewLabel}>Targeting:</span>
        <span style={styles.previewMultiline}>{targetingSummary || "—"}</span>
      </div>
      <div style={styles.previewItem}>
        <span style={styles.previewLabel}>Deadline:</span>
        <span>{formatDeadline(deadline)}</span>
      </div>
      <div style={styles.previewItem}>
        <span style={styles.previewLabel}>Late submissions:</span>
        <span>{allowLate ? "Allowed" : "Not allowed"}</span>
      </div>
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
      style={{
        ...styles.chip,
        ...(selected ? styles.chipSelected : {}),
        ...(disabled ? styles.chipDisabled : {}),
      }}
    >
      {label}
    </button>
  );
}

// Main form 

const RESPONSIVE_CSS = `
  .assignment-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 24px 64px;
  }
  .assignment-layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 28px;
    align-items: start;
  }
  .assignment-form-card {
    background: #fff;
    border-radius: 16px;
    padding: 36px 40px;
    box-shadow: 0 4px 24px rgba(30,60,120,0.08);
    border: 1px solid #e2e8f6;
  }
  .assignment-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 10px;
  }
  .assignment-btn-primary {
    padding: 12px 28px;
    background: linear-gradient(135deg, #1d6ef5, #1558d4);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(29,110,245,0.35);
  }
  .assignment-btn-outline {
    padding: 12px 24px;
    background: #fff;
    color: #374151;
    border: 1.5px solid #d1d9e6;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .assignment-subsection-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  @media (max-width: 900px) {
    .assignment-layout {
      grid-template-columns: 1fr;
    }
    .assignment-form-card {
      padding: 28px 24px;
    }
  }

  @media (max-width: 600px) {
    .assignment-container {
      padding: 16px 12px 48px;
    }
    .assignment-form-card {
      padding: 20px 16px;
      border-radius: 12px;
    }
    .assignment-actions {
      flex-direction: column-reverse;
      gap: 10px;
    }
    .assignment-btn-primary,
    .assignment-btn-outline {
      width: 100%;
      text-align: center;
      padding: 14px;
    }
    .assignment-subsection-row {
      gap: 8px;
    }
  }
`;

function NewAssignmentForm() {
  const router = useRouter();

  useEffect(() => {
    if (typeof document !== "undefined") {
      const id = "assignment-responsive-styles";
      if (!document.getElementById(id)) {
        const tag = document.createElement("style");
        tag.id = id;
        tag.textContent = RESPONSIVE_CSS;
        document.head.appendChild(tag);
      }
    }
  }, []);

  // Subject is stored as a string from  <select> ; 
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [year, setYear] = useState<AcademicYear | "">("");
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
    listSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]))
      .finally(() => setLoadingSubjects(false));
  }, []);

  

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
      prev.includes(group)
        ? prev.filter((g) => g !== group)
        : [...prev, group]
    );
  };

  // Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validationErrors = validate({ subject, title, year, deadline });
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
        target_sections: targetSections.length > 0 ? targetSections : undefined, 
        target_groups: targetGroups.length > 0 ? targetGroups : undefined,       
        deadline: new Date(deadline).toISOString(),
        allow_late: allowLate,                                         
      });
      router.push(`/assignments/${assignment.id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(message);
      setSubmitting(false);
    }
  };

  // Targeting summary for preview
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
    <div style={styles.page}>
      <Header activePage="Assignments" />

      <div className="assignment-container">
        {/* Breadcrumb */}
        <div style={styles.breadcrumb}>
          <span
            style={styles.breadcrumbLink}
            onClick={() => router.push("/assignments")}
          >
            Assignments
          </span>
          <span style={styles.breadcrumbSep}>/</span>
          <span style={styles.breadcrumbCurrent}>New Assignment</span>
        </div>

        <div className="assignment-layout">
          {/* Form Card */}
          <form className="assignment-form-card" onSubmit={handleSubmit}>
            <h2 style={styles.formTitle}>New Assignment</h2>
            <p style={styles.formSubtitle}>
              Create an assignment for your students. Define targeting and deadlines.
            </p>

            {/* Global error */}
            {submitError && (
              <div style={styles.errorBanner}>
                <div style={styles.errorBannerTop}>
                  <span style={styles.errorIcon}>⚠</span>
                  <strong>Error</strong>
                </div>
                <p style={styles.errorMsg}>{submitError}</p>
              </div>
            )}

            <Field label="Subject" required>
              <select
                style={styles.select}
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
                <div style={styles.fieldError}>{errors.subject}</div>
              )}
            </Field>

            <Field label="Title" required>
              <input
                style={styles.input}
                placeholder="e.g. Lab Report 3 — Binary Trees"
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setTitle(e.target.value);
                  setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                disabled={submitting}
                required
              />
              {errors.title && <div style={styles.fieldError}>{errors.title}</div>}
            </Field>

            <Field label="Description" hint="Optional — instructions or context">
              <textarea
                style={{ ...styles.input, minHeight: 100, resize: "vertical" }}
                placeholder="Describe the assignment, expectations, or additional notes..."
                value={description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setDescription(e.target.value)
                }
                disabled={submitting}
              />
            </Field>

            <Field label="Year" required>
              <div style={styles.chipGroup}>
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
              {errors.year && <div style={styles.fieldError}>{errors.year}</div>}
            </Field>

            {year && (
              <>
                <div style={styles.divider} />
                <Field
                  label={isSpecialityYear ? "Speciality" : "Section"}
                  hint="Optional — leave empty for all"
                >
                  <div style={styles.chipGroup}>
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
                      <div key={spec} className="assignment-subsection-row">
                        <span style={styles.subsectionLabel}>{spec}</span>
                        <div style={styles.chipGroup}>
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
                    hint={`Optional — ${
                      isSpecialityYear ? "2 per section" : "4 per section"
                    }`}
                  >
                    {availableGroups.length === 0 ? (
                      <p style={styles.noGroupsMsg}>
                        Select a section to reveal groups.
                      </p>
                    ) : (
                      <div style={styles.chipGroup}>
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

            <Field label="Deadline" required>
              <input
                type="datetime-local"
                style={styles.input}
                value={deadline}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setDeadline(e.target.value);
                  setErrors((prev) => ({ ...prev, deadline: undefined }));
                }}
                disabled={submitting}
                required
              />
              {errors.deadline && (
                <div style={styles.fieldError}>{errors.deadline}</div>
              )}
            </Field>

            <Field label="Late submissions">
              <div style={styles.toggleRow}>
                <input
                  type="checkbox"
                  id="allowLate"
                  checked={allowLate}
                  onChange={(e) => setAllowLate(e.target.checked)}
                  disabled={submitting}
                  style={styles.checkbox}
                />
                <label htmlFor="allowLate" style={styles.toggleLabel}>
                  Allow students to submit after the deadline
                </label>
              </div>
            </Field>

            {/* Progress */}
            {submitting && (
              <div style={styles.progressWrap}>
                <div style={styles.progressHeader}>
                  <span style={styles.progressLabel}>Creating assignment…</span>
                </div>
                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: "30%" }} />
                </div>
              </div>
            )}

            <div className="assignment-actions">
              <button
                type="button"
                className="assignment-btn-outline"
                disabled={submitting}
                onClick={() => router.back()}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`assignment-btn-primary${submitting ? " assignment-btn-disabled" : ""}`}
                style={submitting ? styles.btnDisabled : undefined}
                disabled={submitting}
              >
                {submitting ? "Creating…" : "Create Assignment"}
              </button>
            </div>
          </form>

          {/* Preview */}
          <AssignmentPreview
            subjectName={selectedSubjectName}
            title={title}
            year={year}
            targetingSummary={targetingSummary()}
            deadline={deadline}
            allowLate={allowLate}
          />
        </div>
      </div>
    </div>
  );
}

// Main Page 

export default function NewAssignmentPage() {
  return (
  
    <ProtectedRoute>

    <NewAssignmentForm /> ;

    </ProtectedRoute>

  

  
  );
}

// Styles 

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f0f4ff",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: "#1a2340",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "32px 24px 64px",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 28,
    fontSize: 14,
  },
  breadcrumbLink: {
    color: "#2563eb",
    cursor: "pointer",
    fontWeight: 500,
  },
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
  formTitle: {
    fontSize: 26,
    fontWeight: 800,
    margin: "0 0 6px",
    color: "#0d1b2a",
  },
  formSubtitle: {
    fontSize: 14,
    color: "#64748b",
    margin: "0 0 32px",
  },
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
  chipGroup: { display: "flex", flexWrap: "wrap", gap: 10 },
  chip: {
    padding: "7px 16px",
    borderRadius: 30,
    border: "1.5px solid #d1d9e6",
    background: "#fff",
    color: "#374151",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  chipSelected: {
    background: "linear-gradient(135deg, #1d6ef5, #1558d4)",
    borderColor: "#1d6ef5",
    color: "#fff",
    boxShadow: "0 2px 8px rgba(29,110,245,0.25)",
  },
  chipDisabled: { opacity: 0.6, cursor: "not-allowed" },
  subsectionRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
  },
  subsectionLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: "#2563eb",
    minWidth: 60,
  },
  noGroupsMsg: { fontSize: 13, color: "#64748b", margin: 0 },
  divider: { margin: "12px 0 20px", borderTop: "1px solid #e2e8f0" },
  toggleRow: { display: "flex", alignItems: "center", gap: 10 },
  checkbox: { width: 18, height: 18, cursor: "pointer" },
  toggleLabel: { fontSize: 14, color: "#1a2340", cursor: "pointer" },
  actions: {
    display: "flex",
    gap: 12,
    justifyContent: "flex-end",
    marginTop: 10,
  },
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
  btnDisabled: { opacity: 0.6, cursor: "not-allowed", boxShadow: "none" },
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
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: { fontSize: 13, color: "#1e3a5f", fontWeight: 500 },
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
  errorBannerTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  errorIcon: { fontSize: 16, color: "#b45309" },
  errorMsg: { fontSize: 13, color: "#92400e", margin: "0 0 6px" },
  fieldError: { fontSize: 12, color: "#ef4444", marginTop: 6 },
  previewCard: {
    background: "#fff",
    borderRadius: 16,
    padding: "24px 20px",
    boxShadow: "0 4px 24px rgba(30,60,120,0.08)",
    border: "1px solid #e2e8f6",
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 700,
    margin: "0 0 20px",
    color: "#0d1b2a",
    borderBottom: "2px solid #eef2ff",
    paddingBottom: 10,
  },
  previewItem: { display: "flex", gap: 12, marginBottom: 14, fontSize: 13 },
  previewLabel: {
    width: 100,
    fontWeight: 600,
    color: "#64748b",
    flexShrink: 0,
  },
  previewMultiline: { wordBreak: "break-word", lineHeight: 1.4 },
};