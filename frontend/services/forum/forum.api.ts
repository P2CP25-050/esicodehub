import apiClient from '@/lib/axios';
import type { PaginatedResponse } from '../submissions/submissions.types';
import type {
  Answer,
  AnswerCreatePayload,
  AnswerUpdatePayload,
  ForumListParams,
  QuestionCreatePayload,
  QuestionDetail,
  QuestionListItem,
  VoteResponse,
} from './forum.types';

const QUESTIONS_BASE = '/forum/questions/';

export const listQuestions = async (
  params?: ForumListParams
): Promise<PaginatedResponse<QuestionListItem>> => {
  const res = await apiClient.get<PaginatedResponse<QuestionListItem>>(
    QUESTIONS_BASE,
    { params }
  );
  return res.data;
};

export const getQuestion = async (id: number): Promise<QuestionDetail> => {
  const res = await apiClient.get<QuestionDetail>(`${QUESTIONS_BASE}${id}/`);
  return res.data;
};

export const createQuestion = async (
  data: QuestionCreatePayload
): Promise<QuestionDetail> => {
  const res = await apiClient.post<QuestionDetail>(QUESTIONS_BASE, data);
  return res.data;
};

export const updateQuestion = async (
  id: number,
  data: Partial<QuestionCreatePayload>
): Promise<QuestionDetail> => {
  const res = await apiClient.patch<QuestionDetail>(
    `${QUESTIONS_BASE}${id}/`,
    data
  );
  return res.data;
};

export const deleteQuestion = async (id: number): Promise<void> => {
  await apiClient.delete(`${QUESTIONS_BASE}${id}/`);
};

/**
 * Close a question so it no longer accepts new answers.
 * Sends PATCH { is_closed: true } to the question detail endpoint.
 */
export const closeQuestion = async (id: number): Promise<QuestionDetail> => {
  const res = await apiClient.patch<QuestionDetail>(
    `${QUESTIONS_BASE}${id}/`,
    { is_closed: true }
  );
  return res.data;
};

export const createAnswer = async (
  questionId: number,
  data: AnswerCreatePayload
): Promise<Answer> => {
  const res = await apiClient.post<Answer>(
    `${QUESTIONS_BASE}${questionId}/answers/`,
    data
  );
  return res.data;
};

export const updateAnswer = async (
  questionId: number,
  answerId: number,
  data: AnswerUpdatePayload
): Promise<Answer> => {
  const res = await apiClient.patch<Answer>(
    `${QUESTIONS_BASE}${questionId}/answers/${answerId}/`,
    data
  );
  return res.data;
};

export const deleteAnswer = async (
  questionId: number,
  answerId: number
): Promise<void> => {
  await apiClient.delete(`${QUESTIONS_BASE}${questionId}/answers/${answerId}/`);
};

export const acceptAnswer = async (
  questionId: number,
  answerId: number
): Promise<Answer> => {
  const res = await apiClient.post<Answer>(
    `${QUESTIONS_BASE}${questionId}/answers/${answerId}/accept/`
  );
  return res.data;
};

/**
 * Un-accept (revoke) the currently accepted answer.
 * Calls the same accept endpoint — the backend toggles the state.
 */
export const unacceptAnswer = async (
  questionId: number,
  answerId: number
): Promise<Answer> => {
  const res = await apiClient.post<Answer>(
    `${QUESTIONS_BASE}${questionId}/answers/${answerId}/accept/`
  );
  return res.data;
};

export const voteQuestion = async (
  questionId: number,
  value: 1 | -1
): Promise<VoteResponse> => {
  const res = await apiClient.post<VoteResponse>(
    `${QUESTIONS_BASE}${questionId}/vote/`,
    { value }
  );
  return res.data;
};

export const voteAnswer = async (
  questionId: number,
  answerId: number,
  value: 1 | -1
): Promise<VoteResponse> => {
  const res = await apiClient.post<VoteResponse>(
    `${QUESTIONS_BASE}${questionId}/answers/${answerId}/vote/`,
    { value }
  );
  return res.data;
};