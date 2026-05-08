import apiClient from '@/lib/axios';
import type {
  Assignment,
  AssignmentCreatePayload,
  AssignmentListParams,
  AssignmentSubmission,
  AssignmentSubmissionsListParams,
  AssignmentUpdatePayload,
  PaginatedResponse,
  ReviewCreatePayload,
  SubmissionReview,
  Subject,
} from './assignments.types';

export interface AssignmentDescriptionPdfUploadResponse {
  url: string;
}

export const listAssignments = async (
  params?: AssignmentListParams
): Promise<PaginatedResponse<Assignment>> => {
  const res = await apiClient.get<PaginatedResponse<Assignment>>('/assignments/', {
    params,
  });
  return res.data;
};

export const getAssignment = async (id: number): Promise<Assignment> => {
  const res = await apiClient.get<Assignment>(`/assignments/${id}/`);
  return res.data;
};

export const createAssignment = async (
  data: AssignmentCreatePayload
): Promise<Assignment> => {
  const res = await apiClient.post<Assignment>('/assignments/', data);
  return res.data;
};

export const updateAssignment = async (
  id: number,
  data: AssignmentUpdatePayload
): Promise<Assignment> => {
  const res = await apiClient.patch<Assignment>(`/assignments/${id}/`, data);
  return res.data;
};

export const deleteAssignment = async (id: number): Promise<void> => {
  await apiClient.delete(`/assignments/${id}/`);
};

export const submitToAssignment = async (
  id: number,
  files: File[],
  filePaths: string[]
): Promise<AssignmentSubmission> => {
  if (files.length !== filePaths.length) {
    throw new Error(
      `files and filePaths length mismatch: got ${files.length} files and ${filePaths.length} paths`
    );
  }

  const formData = new FormData();

  files.forEach((file, index) => {
    formData.append('files', file);
    formData.append('file_paths', filePaths[index]);
  });

  const res = await apiClient.post<AssignmentSubmission>(
    `/assignments/${id}/submit/`,
    formData
  );
  return res.data;
};

export const getMySubmission = async (
  assignmentId: number
): Promise<AssignmentSubmission> => {
  const res = await apiClient.get<AssignmentSubmission>(
    `/assignments/${assignmentId}/my-submission/`
  );
  return res.data;
};

export const getSubmissions = async (
  assignmentId: number,
  group?: number
): Promise<PaginatedResponse<AssignmentSubmission>> => {
  const params: AssignmentSubmissionsListParams | undefined =
    group !== undefined ? { group } : undefined;

  const res = await apiClient.get<PaginatedResponse<AssignmentSubmission>>(
    `/assignments/${assignmentId}/submissions/`,
    { params }
  );
  return res.data;
};

export const getSubmission = async (
  assignmentId: number,
  submissionId: number
): Promise<AssignmentSubmission> => {
  const res = await apiClient.get<AssignmentSubmission>(
    `/assignments/${assignmentId}/submissions/${submissionId}/`
  );
  return res.data;
};

export const getSubmissionFileContent = async (
  assignmentId: number,
  submissionId: number,
  fileId: number
): Promise<string> => {
  const res = await apiClient.get<string>(
    `/assignments/${assignmentId}/submissions/${submissionId}/files/${fileId}/content/`,
    {
      headers: { Accept: 'text/plain' },
    }
  );
  return res.data;
};

export const createOrReplaceReview = async (
  assignmentId: number,
  submissionId: number,
  data: ReviewCreatePayload
): Promise<SubmissionReview> => {
  const res = await apiClient.post<SubmissionReview>(
    `/assignments/${assignmentId}/submissions/${submissionId}/review/`,
    data
  );
  return res.data;
};

export const getReviews = async (
  assignmentId: number,
  submissionId: number
): Promise<SubmissionReview[]> => {
  const res = await apiClient.get<SubmissionReview[]>(
    `/assignments/${assignmentId}/submissions/${submissionId}/reviews/`
  );
  return res.data;
};

export const listSubjects = async (): Promise<Subject[]> => {
  const res = await apiClient.get<Subject[]>('/subjects/');
  return res.data;
};

export const uploadAssignmentDescriptionPdf = async (
  id: number,
  file: File
): Promise<AssignmentDescriptionPdfUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiClient.post<AssignmentDescriptionPdfUploadResponse>(
    `/assignments/${id}/upload-description/`,
    formData
  );
  return res.data;
};
