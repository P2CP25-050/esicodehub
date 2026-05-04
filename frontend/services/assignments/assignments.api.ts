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

export const uploadAssignmentDescriptionPdf = async (
  assignmentId: number,
  file: File,
  metadata?: Partial<AssignmentUpdatePayload>
): Promise<Assignment> => {
  const readPdfAsDataUrl = (input: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (typeof FileReader === 'undefined') {
        reject(new Error('FileReader is not available in this environment.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read PDF file.'));
        }
      };
      reader.onerror = () => {
        reject(reader.error ?? new Error('Failed to read PDF file.'));
      };
      reader.readAsDataURL(input);
    });

  const payload: Record<string, string | boolean> = {
    description_pdf: await readPdfAsDataUrl(file),
  };

  if (metadata) {
    if (metadata.title !== undefined) {
      payload.title = metadata.title;
    }
    if (metadata.description !== undefined) {
      payload.description = metadata.description;
    }
    if (metadata.deadline !== undefined) {
      payload.deadline = metadata.deadline;
    }
    if (metadata.allow_late !== undefined) {
      payload.allow_late = metadata.allow_late;
    }
  }

  const res = await apiClient.patch<Assignment>(
    `/assignments/${assignmentId}/`,
    payload
  );
  return res.data;
};

export const deleteAssignment = async (id: number): Promise<void> => {
  await apiClient.delete(`/assignments/${id}/`);
};

export const submitToAssignment = async (
  id: number,
  files: File[],
  filePaths?: string[]
): Promise<AssignmentSubmission> => {
  const normalizePath = (value: string): string =>
    value.replace(/\\/g, '/').replace(/^\/+/, '');

  const resolvedPaths =
    filePaths && filePaths.length === files.length
      ? filePaths.map((path, index) => {
          const trimmed = path?.trim();
          return trimmed ? normalizePath(trimmed) : files[index].name;
        })
      : files.map((file) => file.name);

  const formData = new FormData();

  files.forEach((file, index) => {
    formData.append('files', file, file.name);
    formData.append('file_paths', resolvedPaths[index]);
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
