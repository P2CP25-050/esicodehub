export interface Subject {
  id: number;
  name: string;
  code: string;
}

export interface Assignment {
  id: number;
  title: string;
  description: string;
  subject: Subject;
  target_year: string;
  languages: string[];
  target_sections: string[];
  target_groups: number[];
  deadline: string;
  allow_late: boolean;
  is_open: boolean;
  has_submitted?: boolean;
  professor_name: string;
  submission_count: number;
  created_at: string;
  updated_at: string;
}

export interface AssignmentCreatePayload {
  title: string;
  description?: string;
  subject: number;
  target_year: string;
  languages: string[];
  target_sections?: string[];
  target_groups?: number[];
  deadline: string;
  allow_late?: boolean;
}

export interface AssignmentUpdatePayload {
  title?: string;
  description?: string;
  deadline?: string;
  allow_late?: boolean;
}

export interface AssignmentListParams {
  group?: number;
}

export interface AssignmentSubmissionFile {
  id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

export interface ReviewComment {
  id: number;
  file: number;
  line_number: number;
  content: string;
  created_at: string;
}

export interface SubmissionReview {
  id: number;
  professor_name: string;
  general_comment: string;
  grade: number | null;
  comments: ReviewComment[];
  created_at: string;
  updated_at: string;
}

export interface AssignmentSubmission {
  id: number;
  student_name: string;
  student_email: string;
  submitted_at: string;
  is_late: boolean;
  file_count: number;
  has_reviews: boolean;
  reviews_count: number;
  files?: AssignmentSubmissionFile[];
  reviews?: SubmissionReview[];
}

export interface ReviewCreatePayload {
  general_comment: string;
  grade?: number | null;
  comments: { file_id: number; line_number: number; content: string }[];
}

export interface AssignmentSubmissionsListParams {
  group?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
