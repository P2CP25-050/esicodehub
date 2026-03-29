/**
 * lib/api.ts
 *
 * All API utility functions consumed by the edit submission page.
 * Every function talks to Next.js API routes under /api/.
 *
 * Functions exported:
 *   getSubmission(id)                         → Submission
 *   updateSubmission(id, data)                → Submission
 *   deleteFile(submissionId, fileId)          → void
 *   uploadFiles(submissionId, files, onProgress) → SubmissionFile[]
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubmissionFile {
  id: string;
  name: string;
  path: string;
  size: number; // bytes
}

export interface Submission {
  id: string;
  title: string;
  description: string;
  category: string;
  accessLevel: "public" | "restricted" | "private";
  authors: string;
  version: string;
  license: string;
  tags: string[];
  doi: string;
  files: SubmissionFile[];
  owner: { email: string; name: string };
}

export type SubmissionUpdate = Partial<
  Omit<Submission, "id" | "files" | "owner">
>;

// ─── Base fetch helper ────────────────────────────────────────────────────────

/**
 * Wraps fetch with:
 *   - Automatic /api prefix
 *   - Credentials (session cookies) included
 *   - JSON Content-Type header
 *   - Error extraction from { message } response body
 *   - Graceful 204 handling
 */
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status} ${res.statusText})`;
    try {
      const body = await res.json();
      message = body?.message ?? message;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  // 204 No Content — nothing to parse
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ─── Submissions ──────────────────────────────────────────────────────────────

/**
 * Fetch a single submission by ID.
 *
 * GET /api/submissions/:id
 */
export async function getSubmission(id: string): Promise<Submission> {
  return apiFetch<Submission>(`/submissions/${id}`);
}

/**
 * Partially update submission metadata (title, description, tags, etc.).
 * Does NOT handle file changes — use uploadFiles / deleteFile for those.
 *
 * PATCH /api/submissions/:id
 * Body: SubmissionUpdate (any subset of Submission fields)
 * Returns the updated Submission.
 */
export async function updateSubmission(
  id: string,
  data: SubmissionUpdate
): Promise<Submission> {
  return apiFetch<Submission>(`/submissions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Files ────────────────────────────────────────────────────────────────────

/**
 * Delete a single file from a submission.
 *
 * DELETE /api/submissions/:submissionId/files/:fileId
 * Returns nothing (204).
 */
export async function deleteFile(
  submissionId: string,
  fileId: string
): Promise<void> {
  return apiFetch<void>(`/submissions/${submissionId}/files/${fileId}`, {
    method: "DELETE",
  });
}

/**
 * Upload one or more files to a submission.
 * Uses XMLHttpRequest instead of fetch so upload progress events fire correctly.
 *
 * POST /api/submissions/:id/files  (multipart/form-data, field name: "files")
 *
 * @param submissionId  Target submission ID.
 * @param files         Array of File objects to upload.
 * @param onProgress    Optional callback receiving upload percentage (0–100).
 * @returns             Array of SubmissionFile descriptors for the uploaded files.
 */
export async function uploadFiles(
  submissionId: string,
  files: File[],
  onProgress?: (percent: number) => void
): Promise<SubmissionFile[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  return new Promise<SubmissionFile[]>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/submissions/${submissionId}/files`);
    xhr.withCredentials = true;

    // Progress events
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    // Completion
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as SubmissionFile[]);
        } catch {
          reject(new Error("Server returned an unexpected response format."));
        }
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          message = body?.message ?? message;
        } catch { /* ignore */ }
        reject(new Error(message));
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Network error — check your connection and try again."))
    );
    xhr.addEventListener("abort", () =>
      reject(new Error("Upload was cancelled."))
    );

    xhr.send(formData);
  });
}