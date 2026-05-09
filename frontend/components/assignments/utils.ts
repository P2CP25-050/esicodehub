import type { Assignment } from "@/services/assignments";

/** Format ISO deadline to readable string */
export function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** True when the deadline has passed */
export function isPastDeadline(iso: string): boolean {
  return new Date(iso) < new Date();
}

/**
 * Targeting summary for professor cards.
 * e.g. "2CP • Sections A, B"  |  "2CP • Groups 1, 2"  |  "2CP • All students"
 */
export function getTargetSummary(a: Assignment): string {
  let summary = a.target_year;
  if (a.target_sections.length > 0) {
    summary += ` • Sections ${a.target_sections.join(", ")}`;
  } else if (a.target_groups.length > 0) {
    summary += ` • Groups ${a.target_groups.join(", ")}`;
  } else {
    summary += " • All students";
  }
  return summary;
}

/** Collect sorted, unique group numbers across all assignments */
export function extractGroups(assignments: Assignment[]): number[] {
  const set = new Set<number>();
  assignments.forEach((a) => a.target_groups.forEach((g) => set.add(g)));
  return Array.from(set).sort((a, b) => a - b);
}