import apiClient from "@/lib/axios";

export interface CreateSubmissionPayload {
  title: string;
  language: string;
  submission_type: string;
  visibility: "public" | "private";
  course_tag?: string;
  description?: string;
}

export interface PersonalSubmission {
  id: number;
  title: string;
  language: string;
  submission_type: string;
  visibility: "public" | "private";
  course_tag?: string;
  description?: string;
  created_at: string;
}

/**
 * Main Upload Page API
 * Creates submission + uploads files
 */
export const createSubmissionWithFiles = async ({
  title,
  language,
  submission_type,
  visibility,
  course_tag,
  description,
  files,
}: {
  title: string;
  language: string;
  submission_type: string;
  visibility: "public" | "private";
  course_tag?: string;
  description?: string;
  files: File[];
}): Promise<PersonalSubmission> => {
  let createdSubmission: PersonalSubmission | null = null;

  try {
    // 1️⃣ Create submission
    const submissionRes = await apiClient.post<PersonalSubmission>(
      "/personal-submissions/",
      {
        title,
        language,
        submission_type,
        visibility,
        course_tag,
        description,
      }
    );

    createdSubmission = submissionRes.data;

    // 2️⃣ Upload files
    if (files.length > 0) {
      const formData = new FormData();

      files.forEach((file) => {
        formData.append("files", file);
      });

      await apiClient.post(
        `/personal-submissions/${createdSubmission.id}/files/`,
        formData
      );
    }

    return createdSubmission;
  } catch (error) {
    // rollback if file upload fails
    if (createdSubmission?.id) {
      await apiClient.delete(
        `/personal-submissions/${createdSubmission.id}/`
      );
    }

    throw error;
  }
};