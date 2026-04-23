export type PlagiarismStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface SimilarityMatch {
  id: number;
  language: string;
  student_a_name: string;
  student_a_email: string;
  student_b_name: string;
  student_b_email: string;
  similarity_a: number;
  similarity_b: number;
  max_similarity: number;
  lines_matched: number;
  moss_link: string;
}

export interface PlagiarismReport {
  id: number;
  status: PlagiarismStatus;
  triggered_by: string;
  triggered_at: string;
  completed_at: string | null;
  moss_urls: Record<string, string>;
  error_message: string;
  match_count: number;
  matches: SimilarityMatch[];
}
