import * as assignmentsApi from '@/services/assignments/assignments.api';
import apiClient from '@/lib/axios';

jest.mock('@/lib/axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));

describe('assignments.api', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls PATCH /assignments/5/ with allowed update fields', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({
      data: { id: 5, title: 'Updated title' },
    });

    const result = await assignmentsApi.updateAssignment(5, {
      title: 'Updated title',
      allow_late: true,
    });

    expect(apiClient.patch).toHaveBeenCalledWith('/assignments/5/', {
      title: 'Updated title',
      allow_late: true,
    });
    expect(result.id).toBe(5);
  });

  it('throws when files and filePaths lengths do not match', async () => {
    const file = new File(['print("ok")'], 'main.py', { type: 'text/plain' });

    await expect(assignmentsApi.submitToAssignment(9, [file], [])).rejects.toThrow(
      'files and filePaths length mismatch'
    );

    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('calls POST /assignments/:id/submit/ with FormData when lengths match', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { id: 1, file_count: 1 },
    });

    const file = new File(['print("ok")'], 'main.py', { type: 'text/plain' });
    await assignmentsApi.submitToAssignment(9, [file], ['src/main.py']);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/assignments/9/submit/',
      expect.any(FormData)
    );
  });

  it('calls GET file content endpoint with text/plain accept header', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: 'print("hello")',
    });

    const content = await assignmentsApi.getSubmissionFileContent(1, 2, 3);

    expect(apiClient.get).toHaveBeenCalledWith(
      '/assignments/1/submissions/2/files/3/content/',
      { headers: { Accept: 'text/plain' } }
    );
    expect(content).toBe('print("hello")');
  });

  it('calls review create/replace endpoint', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { id: 7, general_comment: 'Good work', comments: [] },
    });

    const payload = {
      general_comment: 'Good work',
      grade: 16,
      comments: [],
    };

    const result = await assignmentsApi.createOrReplaceReview(1, 2, payload);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/assignments/1/submissions/2/review/',
      payload
    );
    expect(result.id).toBe(7);
  });

  it('calls POST /assignments/:id/upload-description/ with FormData file field', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { url: 'https://storage.googleapis.com/signed.pdf' },
    });

    const file = new File(['pdf-content'], 'description.pdf', {
      type: 'application/pdf',
    });
    await assignmentsApi.uploadAssignmentDescriptionPdf(9, file);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/assignments/9/upload-description/',
      expect.any(FormData)
    );
  });
});
