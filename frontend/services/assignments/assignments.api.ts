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
  description_pdf?: string;
}

const getPdfUrlFromUploadResponse = (
  data: AssignmentDescriptionPdfUploadResponse | Record<string, unknown>
): string => {
  if (typeof data.url === 'string' && data.url.trim()) return data.url;

  const descriptionPdf = (data as { description_pdf?: unknown }).description_pdf;
  if (typeof descriptionPdf === 'string' && descriptionPdf.trim()) {
    return descriptionPdf;
  }

  throw new Error('Upload succeeded but no PDF URL was returned by the server.');
};

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

const getFilenameFromContentDisposition = (value?: string): string | null => {
  if (!value) return null;

  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch && utfMatch[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }

  const quotedMatch = value.match(/filename="([^"]+)"/i);
  if (quotedMatch && quotedMatch[1]) return quotedMatch[1];

  const plainMatch = value.match(/filename=([^;]+)/i);
  if (plainMatch && plainMatch[1]) return plainMatch[1].trim();

  return null;
};

export const downloadSubmissionsZip = async (
  assignmentId: number
): Promise<{ blob: Blob; filename: string }> => {
  const res = await apiClient.get<Blob>(
    `/assignments/${assignmentId}/download-submissions/`,
    {
      responseType: 'blob',
    }
  );

  const contentDisposition = res.headers['content-disposition'];
  const fallbackName = `assignment-${assignmentId}-submissions.zip`;
  const filename =
    getFilenameFromContentDisposition(contentDisposition) || fallbackName;

  return { blob: res.data, filename };
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

  return {
    ...res.data,
    url: getPdfUrlFromUploadResponse(res.data),
  };
};
