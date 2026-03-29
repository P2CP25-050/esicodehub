import apiClient from '@/lib/axios';
import type {
  PersonalSubmission,
  PersonalSubmissionFile,
  PersonalSubmissionCreatePayload,
  SubmissionListParams,
  PaginatedResponse,
} from './submissions.types';

// ============================================================================
// API Functions
// All functions return res.data directly — no need to write .data in the UI
// ============================================================================

/**
 * Fetches a paginated list of the current user's submissions.
 * Optionally filtered by language, submission_type, course_tag, search, or page.
 *
 * @example
 * const submissions = await listSubmissions({ language: 'Python', page: 2 });
 * console.log(submissions.results); // array of submissions
 * console.log(submissions.count);   // total count
 */
export const listSubmissions = async (
  params?: SubmissionListParams
): Promise<PaginatedResponse<PersonalSubmission>> => {
  const requestParams = params
    ? {
        language: params.language,
        // Backend list endpoint expects `type` and `course` query params.
        type: params.type ,
        course: params.course ,
        search: params.search,
        page: params.page,
      }
    : undefined;

  const res = await apiClient.get<PaginatedResponse<PersonalSubmission>>(
    '/personal-submissions/',
    { params: requestParams }
  );
  return res.data;
};

/**
 * Fetches a single submission by ID.
 * Includes nested files and owner in the response.
 *
 * @example
 * const submission = await getSubmission(5);
 * console.log(submission.title);           // "Bubble Sort"
 * console.log(submission.submission_type); // "review_request"
 * console.log(submission.course_tag);      // "Algorithms"
 * console.log(submission.visibility);      // "public"
 */
export const getSubmission = async (
  id: number
): Promise<PersonalSubmission> => {
  const res = await apiClient.get<PersonalSubmission>(
    `/personal-submissions/${id}/`
  );
  return res.data;
};

/**
 * Creates a new submission.
 * Files are uploaded separately after creation using uploadFiles().
 *
 * @example
 * const submission = await createSubmission({
 *   title:           'Bubble Sort',
 *   language:        'Python',
 *   submission_type: 'review_request',
 *   course_tag:      'Algorithms',
 *   visibility:      'public',
 * });
 */
export const createSubmission = async (
  data: PersonalSubmissionCreatePayload
): Promise<PersonalSubmission> => {
  const res = await apiClient.post<PersonalSubmission>(
    '/personal-submissions/',
    data
  );
  return res.data;
};

/**
 * Partially updates an existing submission by ID.
 * Only the fields provided in data will be updated (PATCH not PUT).
 *
 * @example
 * const updated = await updateSubmission(5, { title: 'New Title' });
 * const updated = await updateSubmission(5, { visibility: 'private' });
 */
export const updateSubmission = async (
  id:   number,
  data: Partial<PersonalSubmissionCreatePayload>
): Promise<PersonalSubmission> => {
  const res = await apiClient.patch<PersonalSubmission>(
    `/personal-submissions/${id}/`,
    data
  );
  return res.data;
};

/**
 * Deletes a submission by ID.
 * Also deletes all files attached to it.
 *
 * @example
 * await deleteSubmission(5);
 */
export const deleteSubmission = async (id: number): Promise<void> => {
  await apiClient.delete(`/personal-submissions/${id}/`);
};

/**
 * Uploads one or more files to an existing submission.
 * Uses multipart/form-data because we are sending binary file data.
 * Note: Content-Type header is NOT set manually —
 *       axios detects FormData and sets it automatically with the correct boundary.
 *
 * @param submissionId - the submission to attach files to
 * @param files        - array of File objects selected by the user
 * @param filePaths    - array of relative paths matching each file
 *                       used to preserve folder structure if needed
 *
 * @example
 * await uploadFiles(5, [file1, file2], ['src/main.py', 'src/utils.py']);
 */
export const uploadFiles = async (
  submissionId: number,
  files:        File[],
  filePaths:    string[]
): Promise<PersonalSubmissionFile[]> => {
  const formData = new FormData();

  files.forEach((file, index) => {
    formData.append('files',      file);             // binary file data
    formData.append('file_paths', filePaths[index]); // its relative path
  });

  //  No Content-Type header needed — axios sets it automatically for FormData
  const res = await apiClient.post<PersonalSubmissionFile[]>(
    `/personal-submissions/${submissionId}/files/`,
    formData
  );
  return res.data;
};

/**
 * Deletes a single file from a submission.
 *
 * @example
 * await deleteFile(5, 12); // delete file id=12 from submission id=5
 */
export const deleteFile = async (
  submissionId: number,
  fileId:       number
): Promise<void> => {
  await apiClient.delete(
    `/personal-submissions/${submissionId}/files/${fileId}/`
  );
};

/**
 * Fetches the raw text content of a specific file.
 * Used to display code in the editor or viewer.
 *
 * @example
 * const content = await getFileContent(5, 12);
 * console.log(content); // "def bubble_sort(arr): ..."
 */
export const getFileContent = async (
  submissionId: number,
  fileId:       number
): Promise<string> => {
  const res = await apiClient.get<string>(
    `/personal-submissions/${submissionId}/files/${fileId}/content/`
  );
  return res.data;
};