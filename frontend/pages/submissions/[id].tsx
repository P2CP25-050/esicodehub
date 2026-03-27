import { useCallback, useMemo, useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import axios from 'axios';

import { useAuth } from '@/hooks/useAuth';
import type {
  PersonalSubmission,
  PersonalSubmissionFile,
} from '@/services/submissions/submissions.types';
import {
  deleteSubmission,
  getFileContent,
  getSubmission,
} from '@/services/submissions/submissions.api';
import { relativeTime } from '@/utils/time';

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((m) => m.default),
  { ssr: false }
);

type TreeNode =
  | {
      type: 'dir';
      name: string;
      children: TreeNode[];
    }
  | {
      type: 'file';
      name: string;
      file: PersonalSubmissionFile;
      displayPath: string;
    };

type BuilderDirNode = {
  type: 'dir';
  name: string;
  children: Map<string, BuilderNode>;
};

type BuilderFileNode = Extract<TreeNode, { type: 'file' }>;

type BuilderNode = BuilderDirNode | BuilderFileNode;

const normalizePath = (path: string): string => {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized || path;
};

const getDisplayPath = (file: PersonalSubmissionFile): string => {
  if (file.file_path) return normalizePath(file.file_path);
  return file.file_name;
};

const buildFileTree = (files: PersonalSubmissionFile[]): TreeNode[] => {
  const root: BuilderDirNode = { type: 'dir', name: '', children: new Map() };

  for (const file of files) {
    const displayPath = getDisplayPath(file);
    const parts = displayPath.split('/').filter(Boolean);
    const safeParts = parts.length ? parts : [file.file_name];

    let cursor: BuilderDirNode = root;
    safeParts.forEach((part, index) => {
      const isLast = index === safeParts.length - 1;

      if (isLast) {
        const key = `file:${file.id}`;
        cursor.children.set(key, {
          type: 'file',
          name: part,
          file,
          displayPath,
        });
        return;
      }

      const key = `dir:${part}`;
      if (!cursor.children.has(key)) {
        cursor.children.set(key, {
          type: 'dir',
          name: part,
          children: new Map<string, BuilderNode>(),
        });
      }
      const next = cursor.children.get(key);
      if (next && next.type === 'dir') cursor = next;
    });
  }

  const isDir = (node: BuilderNode): node is BuilderDirNode => node.type === 'dir';
  const isFile = (node: BuilderNode): node is BuilderFileNode => node.type === 'file';

  const toArray = (node: BuilderDirNode): TreeNode[] => {
    const children = Array.from(node.children.values());

    const dirs = children
      .filter(isDir)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((dir) => ({
        type: 'dir' as const,
        name: dir.name,
        children: toArray(dir),
      })) satisfies Extract<TreeNode, { type: 'dir' }>[];

    const leafFiles = children
      .filter(isFile)
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...dirs, ...leafFiles];
  };

  return toArray(root);
};

const languageFromFilename = (filename: string): string | undefined => {
  const name = filename.toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';

  switch (ext) {
    case 'py':
      return 'python';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'mts':
    case 'cts':
      return 'typescript';
    case 'tsx':
      return 'typescript';
    case 'c':
      return 'c';
    case 'h':
      return 'c';
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'hpp':
    case 'hh':
    case 'hxx':
      return 'cpp';
    case 'java':
      return 'java';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'yml':
    case 'yaml':
      return 'yaml';
    default:
      return undefined;
  }
};

const Badge = ({ children }: { children: string }) => (
  <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/80 border border-white/10">
    {children}
  </span>
);

export default function SubmissionDetailPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [submission, setSubmission] = useState<PersonalSubmission | null>(null);
  const [loadingSubmission, setLoadingSubmission] = useState(true);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  const [fileContents, setFileContents] = useState<Map<number, string>>(
    () => new Map()
  );
  const [editorValue, setEditorValue] = useState('');
  const [editorLanguage, setEditorLanguage] = useState<string | undefined>(
    undefined
  );
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const submissionId = useMemo(() => {
    const raw = router.query.id;
    const str = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(str);
    return Number.isFinite(parsed) ? parsed : null;
  }, [router.query.id]);

  const isOwner = useMemo(() => {
    if (!submission?.owner?.email) return false;
    if (!user?.email) return false;
    return submission.owner.email === user.email;
  }, [submission?.owner?.email, user?.email]);

  const fileTree = useMemo(() => {
    const files = submission?.files ?? [];
    return buildFileTree(files);
  }, [submission?.files]);

  const canView = useMemo(() => {
    if (!submission) return false;
    if (submission.visibility === 'public') return true;
    if (submission.visibility === 'private') return isOwner;
    return false;
  }, [submission, isOwner]);

  // ── Fetch submission ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!router.isReady) return;

    if (!submissionId) {
      setSubmission(null);
      setLoadingSubmission(false);
      setSubmissionError('Invalid submission id.');
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoadingSubmission(true);
        setSubmissionError(null);
        setAccessDenied(false);
        const data = await getSubmission(submissionId);
        if (cancelled) return;
        setSubmission(data);
      } catch (err) {
        if (cancelled) return;
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          setAccessDenied(true);
          setSubmission(null);
          return;
        }
        setSubmissionError('Failed to load submission.');
        setSubmission(null);
      } finally {
        if (!cancelled) setLoadingSubmission(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, submissionId]);

  // ── File selection / content loading ───────────────────────────────────────
  const handleSelectFile = useCallback(
    async (file: PersonalSubmissionFile) => {
      if (!submissionId) return;

      setSelectedFileId(file.id);
      const displayPath = getDisplayPath(file);
      setSelectedFileName(displayPath);
      setEditorLanguage(languageFromFilename(displayPath));
      setFileError(null);

      const cached = fileContents.get(file.id);
      if (cached != null) {
        setEditorValue(cached);
        return;
      }

      try {
        setLoadingFile(true);
        const content = await getFileContent(submissionId, file.id);

        setFileContents((prev) => {
          const next = new Map(prev);
          next.set(file.id, content);
          return next;
        });
        setEditorValue(content);
      } catch {
        setFileError('Failed to load file content.');
      } finally {
        setLoadingFile(false);
      }
    },
    [fileContents, submissionId]
  );

  const handleDelete = useCallback(async () => {
    if (!submissionId) return;
    const ok = window.confirm(
      'Delete this submission? This will also delete all attached files.'
    );
    if (!ok) return;

    try {
      await deleteSubmission(submissionId);
      router.push('/submissions');
    } catch {
      window.alert('Failed to delete submission.');
    }
  }, [router, submissionId]);

  const renderTree = useCallback(
    (nodes: TreeNode[], depth = 0) => {
      return nodes.map((node) => {
        if (node.type === 'dir') {
          return (
            <div key={`dir:${depth}:${node.name}`}>
              <div
                className="text-xs font-bold text-white/70 px-2 py-1"
                style={{ paddingLeft: 8 + depth * 12 }}
              >
                {node.name}
              </div>
              <div>{renderTree(node.children, depth + 1)}</div>
            </div>
          );
        }

        const active = node.file.id === selectedFileId;
        return (
          <button
            key={`file:${node.file.id}`}
            type="button"
            onClick={() => handleSelectFile(node.file)}
            className={
              'w-full text-left rounded-md px-2 py-1 text-sm border transition-colors ' +
              (active
                ? 'bg-blue-500/20 border-blue-400/30 text-white'
                : 'bg-white/0 border-transparent text-white/70 hover:bg-white/5 hover:text-white')
            }
            style={{ paddingLeft: 8 + depth * 12 }}
            title={node.displayPath}
          >
            {node.name}
          </button>
        );
      });
    },
    [handleSelectFile, selectedFileId]
  );

  if (loadingSubmission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f1f3d] via-[#1a2b4d] to-[#223659]/60 text-white flex items-center justify-center">
        Loading submission...
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f1f3d] via-[#1a2b4d] to-[#223659]/60 text-white">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-blue-300 hover:text-white"
          >
            ← Back
          </button>
          <h1 className="mt-6 text-3xl font-black">403</h1>
          <p className="mt-2 text-white/70">
            You don’t have permission to view this submission.
          </p>
        </div>
      </div>
    );
  }

  if (submissionError || !submission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f1f3d] via-[#1a2b4d] to-[#223659]/60 text-white">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-blue-300 hover:text-white"
          >
            ← Back
          </button>
          <h1 className="mt-6 text-2xl font-black">Unable to load submission</h1>
          <p className="mt-2 text-white/70">{submissionError ?? 'Not found.'}</p>
        </div>
      </div>
    );
  }

  if (submission.visibility === 'private' && authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f1f3d] via-[#1a2b4d] to-[#223659]/60 text-white flex items-center justify-center">
        Checking access...
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f1f3d] via-[#1a2b4d] to-[#223659]/60 text-white">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-blue-300 hover:text-white"
          >
            ← Back
          </button>
          <h1 className="mt-6 text-3xl font-black">403</h1>
          <p className="mt-2 text-white/70">
            This submission is private, and you don’t have permission to view it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{submission.title} — ESICodeHub</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-[#0f1f3d] via-[#1a2b4d] to-[#223659]/60 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md p-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="text-sm text-blue-300 hover:text-white mt-1"
                  >
                    ← Back
                  </button>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black leading-tight">
                      {submission.title}
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/70">
                      {submission.owner && (
                        <span>
                          {submission.owner.first_name} {submission.owner.last_name}
                        </span>
                      )}
                      <span className="text-white/30">•</span>
                      <Badge>{submission.language}</Badge>
                      <Badge>{submission.submission_type}</Badge>
                      <Badge>{relativeTime(submission.created_at)}</Badge>
                      <Badge>{submission.visibility}</Badge>
                    </div>
                  </div>
                </div>

                {isOwner && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/submissions/${submission.id}/edit`)}
                      className="rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1.5 text-sm font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/20 px-3 py-1.5 text-sm font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {submission.description && (
                <p className="text-sm text-white/80 leading-relaxed">
                  {submission.description}
                </p>
              )}
            </div>
          </div>

          {/* Two-column layout */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* File tree */}
            <aside className="lg:col-span-4 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md p-4">
              <h2 className="text-sm font-bold text-white/80">Files</h2>
              <div className="mt-3 space-y-1 max-h-[70vh] overflow-auto">
                {(submission.files?.length ?? 0) === 0 ? (
                  <div className="text-sm text-white/60">No files attached.</div>
                ) : (
                  renderTree(fileTree)
                )}
              </div>
            </aside>

            {/* Editor */}
            <section className="lg:col-span-8 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
                <div className="text-xs text-white/70 truncate">
                  {selectedFileName ? selectedFileName : 'Select a file to view'}
                </div>
                {fileError && (
                  <div className="text-xs text-red-300">{fileError}</div>
                )}
              </div>

              <div className="relative h-[70vh]">
                {loadingFile && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
                    <div className="flex items-center gap-3 text-sm text-white/80">
                      <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                      Loading file...
                    </div>
                  </div>
                )}

                <MonacoEditor
                  height="100%"
                  theme="vs-dark"
                  language={editorLanguage}
                  value={editorValue}
                  options={{
                    readOnly: true,
                    wordWrap: 'on',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    renderWhitespace: 'selection',
                  }}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
