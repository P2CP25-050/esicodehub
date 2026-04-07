import axios from "axios";

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
    const detail = err.response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) return detail;
    if (typeof err.message === "string" && err.message.trim().length > 0) return err.message;
  }
  if (err instanceof Error && err.message.trim().length > 0) return err.message;
  return fallback;
};

// ─── Profile ─────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's full profile.
 * GET /api/auth/profile/
 *
 * The serializer must nest the related Profile model under the "profile" key,
 * e.g. using a ProfileSerializer with fields: avatar, bio, subjects.
 */
export async function getProfile(): Promise<UserProfile> {
  try {
    const { data } = await axios.get<UserProfile>("/api/auth/profile/");
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, "Failed to load profile."));
  }
}

/**
 * Update the authenticated user's bio.
 * PATCH /api/auth/profile/  →  { bio: string }
 *
 * The backend should update Profile.bio (not User.bio — bio lives on Profile).
 */
export async function updateBio(bio: string): Promise<UserProfile> {
  try {
    const { data } = await axios.patch<UserProfile>("/api/auth/profile/", { bio });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, "Failed to save bio."));
  }
}

/**
 * Upload a new avatar image for the authenticated user.
 * PATCH /api/auth/profile/  (multipart/form-data, field name: "avatar")
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
    const { data } = await axios.patch<UserProfile>("/api/auth/profile/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
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
    const [personalRes, assignmentSubRes, completedRes] = await Promise.allSettled([
      axios.get("/api/submissions/", { params: { mine: true, page_size: 1 } }),
      axios.get("/api/assignment-submissions/", { params: { mine: true, page_size: 1 } }),
      axios.get("/api/assignments/", { params: { has_submitted: true, page_size: 1 } }),
    ]);

    const count = (res: PromiseSettledResult<unknown>): number => {
      if (res.status === "fulfilled") {
        const d = res.value.data;
        if (typeof d?.count === "number") return d.count;
        if (Array.isArray(d)) return d.length;
      }
      return 0;
    };

    return {
      total_personal_submissions: count(personalRes),
      total_assignment_submissions: count(assignmentSubRes),
      assignments_completed: count(completedRes),
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
    const assignmentsRes = await axios.get("/api/assignments/", {
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

/**
 * Derive the user's recent activity from existing endpoints.
 * Currently fetches personal submissions only (limit 10).
 *
 * TODO: add assignment submissions when endpoint is available.
 */
export async function getRecentActivity(): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];

  try {
    const { data } = await axios.get("/api/submissions/", {
      params: { mine: true, page_size: 10, ordering: "-created_at" },
    });

    const submissions: RawSubmission[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.results)
      ? data.results
      : [];

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

  // TODO: add assignment submissions when endpoint is available
  // try {
  //   const { data } = await axios.get("/api/assignment-submissions/", {
  //     params: { mine: true, page_size: 10, ordering: "-created_at" },
  //   });
  // } catch {}

  return items
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
