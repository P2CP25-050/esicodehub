import * as submissionsApi from '@/services/submissions/submissions.api';
import apiClient from '@/lib/axios';

// mock axios
jest.mock('@/lib/axios', () => ({
  get:    jest.fn(),
  post:   jest.fn(),
  patch:  jest.fn(),
  delete: jest.fn(),
}));

describe('submissions.api', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── listSubmissions ────────────────────────────────────────────────────────

  it('calls GET /personal-submissions/', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { count: 1, next: null, previous: null, results: [] }
    });

    const result = await submissionsApi.listSubmissions();

    expect(apiClient.get).toHaveBeenCalledWith(
      '/personal-submissions/',
      { params: undefined }
    );
    expect(result.count).toBe(1);
  });

  it('passes filter params to GET /personal-submissions/', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { count: 0, next: null, previous: null, results: [] }
    });

    await submissionsApi.listSubmissions({ language: 'Python', page: 2 });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/personal-submissions/',
      { params: { language: 'Python', type: undefined, course: undefined, search: undefined, page: 2 } }
    );
  });

  // ── getSubmission ──────────────────────────────────────────────────────────

  it('calls GET /personal-submissions/5/', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { id: 5, title: 'Bubble Sort' }
    });

    const result = await submissionsApi.getSubmission(5);

    expect(apiClient.get).toHaveBeenCalledWith('/personal-submissions/5/');
    expect(result.title).toBe('Bubble Sort');
  });

  // ── createSubmission ───────────────────────────────────────────────────────

  it('calls POST /personal-submissions/', async () => {
    const payload = {
      title: 'Bubble Sort', language: 'Python' as const,
      submission_type: 'review', course_tag: 'Algorithms',
    };
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { id: 1, ...payload }
    });

    const result = await submissionsApi.createSubmission(payload);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/personal-submissions/', payload
    );
    expect(result.id).toBe(1);
  });

  // ── updateSubmission ───────────────────────────────────────────────────────

  it('calls PATCH /personal-submissions/5/', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({
      data: { id: 5, title: 'New Title' }
    });

    const result = await submissionsApi.updateSubmission(5, { title: 'New Title' });

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/personal-submissions/5/', { title: 'New Title' }
    );
    expect(result.title).toBe('New Title');
  });

  // ── deleteSubmission ───────────────────────────────────────────────────────

  it('calls DELETE /personal-submissions/5/', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValue({});

    await submissionsApi.deleteSubmission(5);

    expect(apiClient.delete).toHaveBeenCalledWith('/personal-submissions/5/');
  });

  // ── uploadFiles ────────────────────────────────────────────────────────────

  it('calls POST with FormData for file upload', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: [] });

    const file = new File(['print("hello")'], 'main.py', { type: 'text/plain' });
    await submissionsApi.uploadFiles(5, [file], ['src/main.py']);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/personal-submissions/5/files/',
      expect.any(FormData)  // we just check FormData was sent
    );
  });

  // ── deleteFile ─────────────────────────────────────────────────────────────

  it('calls DELETE /personal-submissions/5/files/12/', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValue({});

    await submissionsApi.deleteFile(5, 12);

    expect(apiClient.delete).toHaveBeenCalledWith(
      '/personal-submissions/5/files/12/'
    );
  });

  // ── getFileContent ─────────────────────────────────────────────────────────

  it('calls GET /personal-submissions/5/files/12/content/', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: 'def bubble_sort(): ...'
    });

    const content = await submissionsApi.getFileContent(5, 12);

    expect(apiClient.get).toHaveBeenCalledWith(
      '/personal-submissions/5/files/12/content/'
    );
    expect(content).toBe('def bubble_sort(): ...');
  });

  // ── comments API ─────────────────────────────────────────────────────────

  it('calls GET /submissions/5/comments/', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

    const result = await submissionsApi.listSubmissionComments(5);

    expect(apiClient.get).toHaveBeenCalledWith('/submissions/5/comments/');
    expect(result).toEqual([]);
  });

  it('calls POST /submissions/5/comments/', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: {
        id: 9,
        line_number: 12,
        body: 'Consider using a list comprehension here.',
        created_at: '2026-05-09T00:00:00Z',
      },
    });

    const result = await submissionsApi.createSubmissionComment(5, {
      line_number: 12,
      body: 'Consider using a list comprehension here.',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/submissions/5/comments/',
      {
        line_number: 12,
        body: 'Consider using a list comprehension here.',
      }
    );
    expect(result.id).toBe(9);
  });

  it('calls DELETE /submissions/5/comments/9/', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValue({});

    await submissionsApi.deleteSubmissionComment(5, 9);

    expect(apiClient.delete).toHaveBeenCalledWith('/submissions/5/comments/9/');
  });

});