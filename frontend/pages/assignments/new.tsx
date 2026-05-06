"use client";
import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import Header from "@/components/submissions/Header";
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

const ASSIGNMENT_LANGUAGES = [
  "python",
  "c",
  "c++",
  "java",
  "javascript",
];

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
  languages?: string;
  deadline?: string;
  descriptionPdf?: string;
}

function validate(
  fields: {
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

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (typeof error.message === "string" && error.message.trim()) return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const formatFileSize = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) return "-";
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const isPdfFile = (file: File): boolean => {
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
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
  pdfName?: string;
}

function AssignmentPreview({
  subjectName,
  title,
  year,
  languages,
  targetingSummary,
  deadline,
  allowLate,
  pdfName,
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
        <span style={styles.previewLabel}>Languages:</span>
        <span>{languages.length ? languages.join(", ") : "—"}</span>
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
      <div style={styles.previewItem}>
        <span style={styles.previewLabel}>PDF:</span>
        <span>{pdfName || "—"}</span>
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
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

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
  const [languages, setLanguages] = useState<string[]>([]);
  const [targetSections, setTargetSections] = useState<string[]>([]);
  const [targetSubSections, setTargetSubSections] = useState<string[]>([]);
  const [targetGroups, setTargetGroups] = useState<number[]>([]);
  const [deadline, setDeadline] = useState("");
  const [allowLate, setAllowLate] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);

  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdAssignmentId, setCreatedAssignmentId] = useState<number | null>(null);

  
  useEffect(() => {
    listSubjects()
      .then((data) => {
        setSubjects(data);
        setSubjectError(null);
      })
      .catch((err) => {
        setSubjects([]);
        setSubjectError(getErrorMessage(err, "Failed to load subjects."));
      })
      .finally(() => setLoadingSubjects(false));
  }, []);

  const openPdfDialog = () => {
    pdfInputRef.current?.click();
  };

  const setPdfFile = (file: File) => {
    if (!isPdfFile(file)) {
      setErrors((previous) => ({
        ...previous,
        descriptionPdf: "Please upload a PDF file.",
      }));
      return;
    }

    setErrors((previous) => ({ ...previous, descriptionPdf: undefined }));
    setSelectedPdf(file);
  };

  const handlePdfInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    event.target.value = "";
  };

  const clearSelectedPdf = () => {
    setSelectedPdf(null);
    if (pdfInputRef.current) {
      pdfInputRef.current.value = "";
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
      prev.includes(group)
        ? prev.filter((g) => g !== group)
        : [...prev, group]
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

  // Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setCreatedAssignmentId(null);

    const validationErrors = validate({
      subject,
      title,
      year,
      languages,
      deadline,
    });
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
      if (selectedPdf) {
        try {
          await uploadAssignmentDescriptionPdf(assignment.id, selectedPdf);
        } catch (error: unknown) {
          setCreatedAssignmentId(assignment.id);
          setSubmitError(
            getErrorMessage(
              error,
              "Assignment created, but PDF upload failed. You can attach it from the edit page."
            )
          );
          setSubmitting(false);
          return;
        }
      }

      router.push(`/assignments/${assignment.id}`);
    } catch (err: unknown) {
      setSubmitError(getErrorMessage(err, "Something went wrong. Please try again."));
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
                {createdAssignmentId && (
                  <div style={styles.errorBannerActions}>
                    <button
                      type="button"
                      style={styles.errorActionPrimary}
                      onClick={() => router.push(`/assignments/${createdAssignmentId}`)}
                    >
                      Go to assignment
                    </button>
                    <button
                      type="button"
                      style={styles.errorActionGhost}
                      onClick={() => router.push(`/assignments/${createdAssignmentId}/edit`)}
                    >
                      Upload PDF later
                    </button>
                  </div>
                )}
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
                  {loadingSubjects
                    ? "Loading subjects..."
                    : subjectError
                      ? "Failed to load subjects"
                      : "Select a subject"}
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
              {subjectError && !loadingSubjects && (
                <div style={styles.fieldError}>{subjectError}</div>
              )}
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

            <Field label="PDF instructions" hint="Optional — attach a PDF for students">
              {selectedPdf ? (
                <div style={styles.pdfCard}>
                  <div>
                    <p style={styles.pdfName}>{selectedPdf.name}</p>
                    <p style={styles.pdfMeta}>{formatFileSize(selectedPdf.size)}</p>
                  </div>
                  <div style={styles.pdfActions}>
                    <button
                      type="button"
                      style={styles.pdfButton}
                      onClick={openPdfDialog}
                      disabled={submitting}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      style={{ ...styles.pdfButton, ...styles.pdfButtonGhost }}
                      onClick={clearSelectedPdf}
                      disabled={submitting}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  style={styles.pdfButton}
                  onClick={openPdfDialog}
                  disabled={submitting}
                >
                  Attach PDF
                </button>
              )}
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfInput}
                style={{ display: "none" }}
              />
              {errors.descriptionPdf && (
                <div style={styles.fieldError}>{errors.descriptionPdf}</div>
              )}
            </Field>

            <Field label="Languages" required>
              <div style={styles.chipGroup}>
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
                <div style={styles.fieldError}>{errors.languages}</div>
              )}
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
            languages={languages}
            targetingSummary={targetingSummary()}
            deadline={deadline}
            allowLate={allowLate}
            pdfName={selectedPdf?.name}
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
  errorBannerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 10,
  },
  errorActionPrimary: {
    padding: "8px 14px",
    background: "#1d6ef5",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  errorActionGhost: {
    padding: "8px 14px",
    background: "#fff",
    color: "#374151",
    border: "1px solid #d1d9e6",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  fieldError: { fontSize: 12, color: "#ef4444", marginTop: 6 },
  pdfCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 14px",
    border: "1px solid #e2e8f6",
    borderRadius: 10,
    background: "#fff",
  },
  pdfName: { fontSize: 13, fontWeight: 600, color: "#1a2340", margin: 0 },
  pdfMeta: { fontSize: 12, color: "#64748b", margin: 0 },
  pdfActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  pdfButton: {
    padding: "8px 14px",
    background: "linear-gradient(135deg, #1d6ef5, #1558d4)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  pdfButtonGhost: {
    background: "#fff",
    color: "#374151",
    border: "1px solid #d1d9e6",
    boxShadow: "none",
  },
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
