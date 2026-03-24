//submissions.types.ts

export const SUPPORTED_LANGUAGES = [
  // Common languages first
  'Python',
  'C',
  'C++',
  'Java',
  'JavaScript',
  'TypeScript',
  // Rest of MOSS-supported languages
  'C#',
  'PHP',
  'Ruby',
  'Swift',
  'Kotlin',
  'Go',
  'Rust',
  'Scala',
  'Haskell',
  'MATLAB',
  'Perl',
  'R',
  'SQL',
  'Assembly',
  'Pascal',
  'Fortran',
  'VHDL',
  'Verilog',
] as const; // readonly — cannot be modified


export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

//interfaces
// Represents a single file attached to a submission
export interface PersonalSubmissionFile {
  id:         number;
  file_name:  string; // e.g. "bubble_sort.py"
  file_path:  string; // path on the server
  file_size:  number; // size in bytes
  created_at: string; // ISO date string e.g. "2024-01-15T10:30:00Z"
}

//the student or professor who created the submission
export interface SubmissionOwner {
  email:      string;
  first_name: string;
  last_name:  string;
  role:       'student' | 'professor';
}

// Represents a student's submission, including metadata and optionally attached files and owner info.
export interface PersonalSubmission {
  id:          number;
  title:       string;
  description: string;
  language:    SupportedLanguage; //  typed — only valid languages allowed
  type:        string;            // e.g. "assignment" | "project" | "exercise"
  course:      string;            // e.g. "alsdd", "sys2"
  is_public:   boolean;           // whether other students can see it
  created_at:  string;
  updated_at:  string;
  files?:      PersonalSubmissionFile[]; // only in detail view
  owner?:      SubmissionOwner;          // only in detail view
}

// Payload for creating a new submission. All fields except description and is_public are required.
export interface PersonalSubmissionCreatePayload {
  title:        string;
  description?: string;
  language:     SupportedLanguage; //  typed — prevents sending "Pyhton" etc.
  type:         string;
  course:       string;
  is_public?:   boolean;           // defaults to false if not provided
}

// Parameters for listing submissions with optional filters and pagination
export interface SubmissionListParams {
  language?: SupportedLanguage; //  typed filter
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