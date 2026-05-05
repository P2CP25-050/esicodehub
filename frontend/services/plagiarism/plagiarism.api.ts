import apiClient from '@/lib/axios';
import type { AIReferencesStatus, PlagiarismReport } from './plagiarism.types';

export const triggerPlagiarismCheck = async (
  assignmentId: number
): Promise<{ report_id: number; status: string }> => {
  const res = await apiClient.post(
    `/assignments/${assignmentId}/plagiarism-report/run/`
  );
  return res.data;
};

export const getPlagiarismReport = async (
  assignmentId: number
): Promise<PlagiarismReport> => {
  const res = await apiClient.get<PlagiarismReport>(
    `/assignments/${assignmentId}/plagiarism-report/`
  );
  return res.data;
};

export const generateAIReferences = async (
  assignmentId: number
): Promise<{ status: string; message: string }> => {
  const res = await apiClient.post(
    `/assignments/${assignmentId}/plagiarism-report/generate-references/`
  );
  return res.data;
};

export const getAIReferencesStatus = async (
  assignmentId: number
): Promise<AIReferencesStatus> => {
  const res = await apiClient.get<AIReferencesStatus>(
    `/assignments/${assignmentId}/plagiarism-report/references-status/`
  );
  return res.data;
};
