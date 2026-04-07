import axios from "axios";
import apiClient from "@/lib/axios";

// ─── Types ────────────────────────────────────────────────────────────────────

// Matches the nested Profile model (OneToOne on User, auto-created via post_save signal)
export interface UserProfileNested {
  avatar: string | null; // Django ImageField → serialized as an absolute URL string
  bio: string;
  subjects: { id: number; name: string; code: string }[];
}

// Matches the User model fields exactly
export interface UserProfile {
  id: number;
  first_name: string;       // on User
  last_name: string;        // on User
  email: string;            // on User (USERNAME_FIELD)
  role: "student" | "professor"; // on User (TextChoices)
  school_id: string;        // on User (max_length=20, blank=True)
  created_at: string;       // on User (auto_now_add)
  // bio and avatar live on the related Profile model, not User directly
  profile: UserProfileNested;
}

// Stats shape for students
export interface StudentStats {
  total_personal_submissions: number;
  total_assignment_submissions: number;
  assignments_completed: number;
}

// Stats shape for professors
export interface ProfessorStats {
  total_assignments: number;
  total_submissions_received: number;
  total_reviews_given?: number; // May not be available yet — omit if missing
}

export type ProfileStats = StudentStats | ProfessorStats;

export interface ActivityItem {
  icon: string;
  label: string;
  sub?: string;
  created_at: string; // ISO date string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getApiErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    const detail = data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) return detail;

    // Handle DRF field errors, e.g. { avatar: ["Upload a valid image..."] }
    if (data && typeof data === "object") {
      const values = Object.values(data as Record<string, unknown>);
      for (const value of values) {
        if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim().length > 0) {
          return value[0];
        }
        if (typeof value === "string" && value.trim().length > 0) {
          return value;
        }
      }
    }

    if (typeof err.message === "string" && err.message.trim().length > 0) return err.message;
  }
  if (err instanceof Error && err.message.trim().length > 0) return err.message;
  return fallback;
};

const getListData = <T>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];

  if (typeof data === "object" && data !== null && "results" in data) {
    const results = (data as { results?: unknown }).results;
    if (Array.isArray(results)) return results as T[];
  }

  return [];
};

const getCountData = (data: unknown, fallbackLength: number): number => {
  if (typeof data === "object" && data !== null && "count" in data) {
    const count = (data as { count?: unknown }).count;
    if (typeof count === "number") return count;
  }

  return fallbackLength;
};

// ─── Profile ─────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's full profile.
 * GET /auth/profile/
 *
 * The serializer must nest the related Profile model under the "profile" key,
 * e.g. using a ProfileSerializer with fields: avatar, bio, subjects.
 */
export async function getProfile(): Promise<UserProfile> {
  try {
    const { data } = await apiClient.get<UserProfile>("/auth/profile/");
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, "Failed to load profile."));
  }
}

/**
 * Update the authenticated user's bio.
 * PATCH /auth/profile/  →  { bio: string }
 *
 * The backend should update Profile.bio (not User.bio — bio lives on Profile).
 */
export async function updateBio(bio: string): Promise<UserProfile> {
  try {
    const { data } = await apiClient.patch<UserProfile>("/auth/profile/", { bio });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, "Failed to save bio."));
  }
}

/**
 * Upload a new avatar image for the authenticated user.
 * PATCH /auth/profile/  (multipart/form-data, field name: "avatar")
 *
 * The backend updates Profile.avatar (ImageField, upload_to="avatars/").
 * The response must include { profile: { avatar: "<url>" } }.
 *
 * NOTE: Coordinate with backend team — the PATCH endpoint must accept
 * multipart/form-data in addition to JSON for this to work.
 */
export async function uploadAvatar(file: File): Promise<{ avatar: string }> {
  const form = new FormData();
  // Field name must match Profile.avatar (the ImageField name on the model)
  form.append("avatar", file);

  try {
    const { data } = await apiClient.patch<UserProfile>("/auth/profile/", form);
    // avatar URL is nested under profile
    return { avatar: data.profile.avatar ?? "" };
  } catch (err) {
    throw new Error(getApiErrorMessage(err, "Avatar upload failed."));
  }
}

// ─── Stats — Student ─────────────────────────────────────────────────────────

/**
 * Derive student stats from existing list endpoints.
 */
export async function getStudentStats(): Promise<StudentStats> {
  try {
    const personalRes = await apiClient.get("/personal-submissions/", {
      params: { mine: true, page: 1 },
    });

    const personalSubmissions = getListData<RawSubmission>(personalRes.data);
    const totalPersonalSubmissions = getCountData(
      personalRes.data,
      personalSubmissions.length,
    );

    const assignmentsRes = await apiClient.get("/assignments/", {
      params: { page: 1 },
    });
    const assignments = getListData<RawAssignment>(assignmentsRes.data);

    const assignmentSubmissionChecks = await Promise.allSettled(
      assignments.map((assignment) =>
        apiClient.get(`/assignments/${assignment.id}/my-submission/`),
      ),
    );

    const assignmentSubmissionCount = assignmentSubmissionChecks.filter(
      (result) => result.status === "fulfilled",
    ).length;

    return {
      total_personal_submissions: totalPersonalSubmissions,
      total_assignment_submissions: assignmentSubmissionCount,
      assignments_completed: assignmentSubmissionCount,
    };
  } catch (err) {
    throw new Error(getApiErrorMessage(err, "Failed to load student stats."));
  }
}

// ─── Stats — Professor ───────────────────────────────────────────────────────

/**
 * Derive professor stats from existing list endpoints.
 */
export async function getProfessorStats(): Promise<ProfessorStats> {
  try {
    const assignmentsRes = await apiClient.get("/assignments/", {
      params: { mine: true, page_size: 100 },
    });

    const assignments: { submission_count?: number }[] = (() => {
      const d = assignmentsRes.data;
      if (Array.isArray(d)) return d;
      if (Array.isArray(d?.results)) return d.results;
      return [];
    })();

    const total_assignments = (() => {
      if (typeof assignmentsRes.data?.count === "number") return assignmentsRes.data.count;
      return assignments.length;
    })();

    const total_submissions_received = assignments.reduce(
      (acc, a) => acc + (a.submission_count ?? 0),
      0,
    );

    // TODO: fetch total_reviews_given when backend exposes a reviews endpoint
    // const reviewsRes = await axios.get("/api/reviews/", { params: { given_by_me: true, page_size: 1 } });
    // const total_reviews_given = reviewsRes.data?.count ?? 0;

    return {
      total_assignments,
      total_submissions_received,
      // total_reviews_given intentionally omitted until endpoint is ready
    };
  } catch (err) {
    throw new Error(getApiErrorMessage(err, "Failed to load professor stats."));
  }
}

// ─── Recent Activity ─────────────────────────────────────────────────────────

interface RawSubmission {
  id: number;
  title: string;
  created_at: string;
  submission_type?: string;
}

interface RawAssignment {
  id: number;
  title: string;
}

interface RawAssignmentSubmission {
  submitted_at: string;
  is_late?: boolean;
}

/**
 * Derive the user's recent activity from existing endpoints.
 * Currently fetches personal submissions only (limit 10).
 *
 * TODO: add assignment submissions when endpoint is available.
 */
export async function getRecentActivity(): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];

  try {
    const { data } = await apiClient.get("/personal-submissions/", {
      params: { mine: true, page: 1 },
    });

    const submissions = getListData<RawSubmission>(data);

    for (const sub of submissions.slice(0, 10)) {
      items.push({
        icon: "📤",
        label: `Shared "${sub.title}"`,
        sub: sub.submission_type ? capitalize(sub.submission_type) : undefined,
        created_at: sub.created_at,
      });
    }
  } catch {
    // Non-fatal — return what we have
  }

  try {
    const { data } = await apiClient.get("/assignments/", { params: { page: 1 } });
    const assignments = getListData<RawAssignment>(data);

    const submissionChecks = await Promise.allSettled(
      assignments.map(async (assignment) => {
        const submissionRes = await apiClient.get<RawAssignmentSubmission>(
          `/assignments/${assignment.id}/my-submission/`,
        );

        return {
          assignment,
          submission: submissionRes.data,
        };
      }),
    );

    for (const result of submissionChecks) {
      if (result.status !== "fulfilled") continue;

      const { assignment, submission } = result.value;
      if (!submission?.submitted_at) continue;

      items.push({
        icon: "📝",
        label: `Submitted assignment "${assignment.title}"`,
        sub: submission.is_late ? "Late submission" : "On-time submission",
        created_at: submission.submitted_at,
      });
    }
  } catch {
    // Non-fatal — return what we have
  }

  return items
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
