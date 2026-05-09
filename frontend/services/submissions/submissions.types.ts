//submissions.types.ts

export const SUPPORTED_LANGUAGES = [
  // Common first
  'Python', 'C', 'C++', 'Java', 'JavaScript', 'TypeScript',
  // Rest of MOSS-supported languages
  'C#', 'Visual Basic', 'Fortran', 'ML', 'Haskell',
  'Lisp', 'Scheme', 'Pascal', 'Modula2', 'Ada',
  'Perl', 'TCL', 'MATLAB', 'VHDL', 'Verilog',
  'Spice', 'MIPS Assembly', 'x86 Assembly', 'HCL2',
] as const;


export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

//interfaces
// Represents a single file attached to a submission
export interface PersonalSubmissionFile {
  id:         number;
  file_name:  string; // e.g. "bubble_sort.py"
  file_path:  string; // path on the server
  file_size:  number; // size in bytes
  created_at: string; // ISO date string 
}

//the student or professor who created the submission
export interface SubmissionOwner {
  email:      string;
  first_name: string;
  last_name:  string;
  role:       'student' | 'professor';
}

export interface SubmissionCommentAuthor {
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
}

export interface SubmissionComment {
  id: number;
  line_number: number;
  body: string;
  created_at: string;
  author?: SubmissionCommentAuthor;
  author_name?: string;
  author_email?: string;
  author_avatar?: string | null;
}

export interface SubmissionCommentCreatePayload {
  line_number: number;
  body: string;
}

// Represents a student's submission, including metadata and optionally attached files and owner info.
export interface PersonalSubmission {
  id:          number;
  title:       string;
  description: string;
  language:    string; 
  submission_type:        string;            // e.g. "assignment" | "project" | "exercise"
  course_tag:      string;            // e.g. "alsdd", "sys2"
  visibility:   'public' | 'private';           // whether other students can see it
  created_at:  string;
  updated_at:  string;
  files?:      PersonalSubmissionFile[]; // only in detail view
  owner?:      SubmissionOwner;          // only in detail view
}

// Payload for creating a new submission. All fields except description and is_public are required.
export interface PersonalSubmissionCreatePayload {
  title:        string;
  description?: string;
  language:     string; //  typed — prevents sending "Pyhton" etc.
  submission_type:         string;
  course_tag:       string;
  visibility?:   'public' | 'private';           // defaults to 'private' if not provided
}

// Parameters for listing submissions with optional filters and pagination
export interface SubmissionListParams {
  language?: string; //  typed filter

  type?:     string;
  course?:   string;
  search?:   string;            // search by title or description
  page?:     number;            // which page to fetch
}

/**
 * Generic paginated response wrapper from Django REST Framework.
 * T is the type of items in the results array.
 *
 * Example usage:
 * PaginatedResponse<PersonalSubmission>
 * → { count: 200, next: "...?page=2", previous: null, results: [...] }
 */
export interface PaginatedResponse<T> {
  count:    number;        // total number of items across all pages
  next:     string | null; // URL of next page,     null if on last page
  previous: string | null; // URL of previous page, null if on first page
  results:  T[];           // items for the current page
}
