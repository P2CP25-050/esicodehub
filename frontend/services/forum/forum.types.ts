export type ForumOrdering = 'newest' | 'top' | 'unanswered';

export interface Answer {
  id: number;
  question: number;
  parent: number | null;
  author_name: string;
  author_email: string;
  body: string;
  code_snippet: string;
  code_language: string;
  is_accepted: boolean;
  vote_score: number;
  user_vote: 1 | -1 | null;
  reply_count: number;
  replies: Answer[];
  created_at: string;
  updated_at: string;
}

export interface QuestionListItem {
  id: number;
  title: string;
  tags: string[];
  author_name: string;
  author_avatar?: string | null;
  author_username?: string;
  author_id?: number;
  body?: string;
  description?: string;
  answer_count: number;
  vote_score: number;
  has_accepted_answer: boolean;
  view_count: number;
  created_at: string;
}

export interface QuestionDetail extends QuestionListItem {
  body: string;
  code_snippet: string;
  code_language: string;
  is_closed: boolean;
  author_email: string;
  can_accept_answer: boolean;
  answers: Answer[];
}

export interface QuestionCreatePayload {
  title: string;
  body: string;
  code_snippet?: string;
  code_language?: string;
  tags?: string[];
}

export interface AnswerCreatePayload {
  body: string;
  code_snippet?: string;
  code_language?: string;
  parent_id?: number | null;
}

export interface ForumListParams {
  tag?: string;
  search?: string;
  author?: string;
  ordering?: ForumOrdering;
  page?: number;
}

export interface VoteResponse {
  vote_score: number;
}
