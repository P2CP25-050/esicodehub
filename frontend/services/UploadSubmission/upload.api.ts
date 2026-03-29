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
 * Step 1: Create the submission record, returns the new submission with its ID.
 */
export const createSubmission = async (
  payload: CreateSubmissionPayload
): Promise<PersonalSubmission> => {
  const res = await apiClient.post<PersonalSubmission>(
    "/personal-submissions/",
    payload
  );
  return res.data;
};

/**
 * Step 2: Upload files to an existing submission.
 * Accepts an optional onProgress callback (0–100).
 */
export const uploadFiles = async (
  submissionId: number,
  files: { file: File; relativePath: string }[],
  onProgress?: (percent: number) => void
): Promise<void> => {
  if (files.length === 0) return;

  const formData = new FormData();
  files.forEach(({ file, relativePath }) => {
    formData.append("files", file, relativePath);
  });

  await apiClient.post(
    `/personal-submissions/${submissionId}/files/`,
    formData,
    {
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    }
  );
};

/**
 * Rollback helper — deletes the submission if file upload fails.
 */
export const deleteSubmission = async (submissionId: number): Promise<void> => {
  await apiClient.delete(`/personal-submissions/${submissionId}/`);
};