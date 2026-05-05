import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import axios from 'axios';
import type { EditorProps } from '@monaco-editor/react';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import Header from '@/components/submissions/Header';
import { useAuth } from '@/context/AuthContext';
import type {
  PersonalSubmission,
  PersonalSubmissionFile,
} from '@/services/submissions/submissions.types';
import {
  deleteSubmission,
  getFileContent,
  getSubmission,
} from '@/services/submissions/submissions.api';
import { timeAgo } from '@/utils/time';

const MonacoEditor = dynamic<EditorProps>(
  () => import('@monaco-editor/react').then((module) => module.default),
  { ssr: false }
);

type TreeDirNode = {
  kind: 'dir';
  name: string;
  fullPath: string;
  children: TreeNode[];
};

type TreeFileNode = {
  kind: 'file';
  name: string;
  fullPath: string;
  file: PersonalSubmissionFile;
};

type TreeNode = TreeDirNode | TreeFileNode;

type BuilderDirNode = {
  kind: 'dir';
  name: string;
  fullPath: string;
  children: Map<string, BuilderNode>;
};

type BuilderFileNode = TreeFileNode;
type BuilderNode = BuilderDirNode | BuilderFileNode;

type ViewState = 'idle' | 'loading' | 'ready' | 'error' | 'forbidden';

type VisibleTreeItem = {
  key: string;
  kind: 'dir' | 'file';
  fullPath: string;
  depth: number;
  parentKey: string | null;
  file?: PersonalSubmissionFile;
  isExpanded?: boolean;
};

const normalizePath = (path: string): string => {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized || path;
};

const getDisplayPath = (file: PersonalSubmissionFile): string => {
  if (file.file_path) return normalizePath(file.file_path);
  return file.file_name;
};

const buildFileTree = (files: PersonalSubmissionFile[]): TreeNode[] => {
  const root: BuilderDirNode = {
    kind: 'dir',
    name: '',
    fullPath: '',
    children: new Map<string, BuilderNode>(),
  };

  for (const file of files) {
    const displayPath = getDisplayPath(file);
    const rawParts = displayPath.split('/').filter(Boolean);
    const parts = rawParts.length ? rawParts : [file.file_name];

    let cursor: BuilderDirNode = root;
    let parentPath = '';

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const nodePath = parentPath ? `${parentPath}/${part}` : part;

      if (isLast) {
        const fileKey = `file:${nodePath}:${file.id}`;
        cursor.children.set(fileKey, {
          kind: 'file',
          name: part,
          fullPath: nodePath,
          file,
        });
        return;
      }

      const dirKey = `dir:${nodePath}`;
      if (!cursor.children.has(dirKey)) {
        cursor.children.set(dirKey, {
          kind: 'dir',
          name: part,
          fullPath: nodePath,
          children: new Map<string, BuilderNode>(),
        });
      }

      const next = cursor.children.get(dirKey);
      if (next && next.kind === 'dir') {
        cursor = next;
        parentPath = nodePath;
      }
    });
  }

  const isDir = (node: BuilderNode): node is BuilderDirNode => node.kind === 'dir';
  const isFile = (node: BuilderNode): node is BuilderFileNode => node.kind === 'file';

  const mapToArray = (node: BuilderDirNode): TreeNode[] => {
    const allChildren = Array.from(node.children.values());

    const dirs = allChildren
      .filter(isDir)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((dir) => ({
        kind: 'dir' as const,
        name: dir.name,
        fullPath: dir.fullPath,
        children: mapToArray(dir),
      }));

    const leafFiles = allChildren
      .filter(isFile)
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...dirs, ...leafFiles];
  };

  return mapToArray(root);
};

const languageFromFilename = (filename: string): string => {
  const lower = filename.toLowerCase();
  const ext = lower.includes('.') ? lower.split('.').pop() : '';

  switch (ext) {
    case 'py':
      return 'python';
    case 'js':
    case 'mjs':
    case 'cjs':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'mts':
    case 'cts':
    case 'tsx':
      return 'typescript';
    case 'c':
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
    case 'xml':
      return 'xml';
    default:
      return 'plaintext';
  }
};

const flattenFiles = (nodes: TreeNode[]): TreeFileNode[] => {
  const out: TreeFileNode[] = [];

  const traverse = (items: TreeNode[]) => {
    items.forEach((item) => {
      if (item.kind === 'file') {
        out.push(item);
      } else {
        traverse(item.children);
      }
    });
  };

  traverse(nodes);
  return out;
};

const getDirKey = (fullPath: string): string => `dir:${fullPath}`;
const getFileKey = (fileId: number): string => `file:${fileId}`;

const flattenVisibleTree = (
  nodes: TreeNode[],
  expandedPaths: Set<string>
): VisibleTreeItem[] => {
  const out: VisibleTreeItem[] = [];

  const visit = (
    items: TreeNode[],
    depth: number,
    parentKey: string | null
  ) => {
    items.forEach((item) => {
      if (item.kind === 'dir') {
        const dirKey = getDirKey(item.fullPath);
        const isExpanded = expandedPaths.has(item.fullPath);

        out.push({
          key: dirKey,
          kind: 'dir',
          fullPath: item.fullPath,
          depth,
          parentKey,
          isExpanded,
        });

        if (isExpanded) {
          visit(item.children, depth + 1, dirKey);
        }
        return;
      }

      out.push({
        key: getFileKey(item.file.id),
        kind: 'file',
        fullPath: item.fullPath,
        depth,
        parentKey,
        file: item.file,
      });
    });
  };

  visit(nodes, 0, null);
  return out;
};

const formatFileSize = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) return '-';
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const Badge = ({ label }: { label: string }) => (
  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
    {label}
  </span>
);

const HeaderSkeleton = () => (
  <div className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm">
    <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
    <div className="mt-4 h-8 w-2/3 animate-pulse rounded bg-slate-200" />
    <div className="mt-3 flex gap-2">
      <div className="h-6 w-20 animate-pulse rounded bg-slate-200" />
      <div className="h-6 w-20 animate-pulse rounded bg-slate-200" />
      <div className="h-6 w-20 animate-pulse rounded bg-slate-200" />
    </div>
  </div>
);

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow"
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className="text-slate-500 transition-transform duration-200 group-hover:-translate-x-0.5 group-hover:text-slate-700"
      aria-hidden="true"
    >
      <path
        d="M6.5 3.5 2 8m0 0 4.5 4.5M2 8h12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    Back to submissions
  </button>
);

type FileTreeProps = {
  nodes: TreeNode[];
  selectedFileId: number | null;
  activeItemKey: string | null;
  expandedPaths: Set<string>;
  onToggleDir: (fullPath: string) => void;
  onSelectFile: (file: PersonalSubmissionFile) => void;
  onItemFocus: (key: string) => void;
  onItemKeyDown: (key: string, event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  registerItemRef: (key: string, element: HTMLButtonElement | null) => void;
};

const FileTree = memo(function FileTree({
  nodes,
  selectedFileId,
  activeItemKey,
  expandedPaths,
  onToggleDir,
  onSelectFile,
  onItemFocus,
  onItemKeyDown,
  registerItemRef,
}: FileTreeProps) {
  const renderNodes = (items: TreeNode[], depth = 0) => {
    return items.map((node) => {
      if (node.kind === 'dir') {
        const isExpanded = expandedPaths.has(node.fullPath);
        const itemKey = getDirKey(node.fullPath);
        return (
          <div key={itemKey}>
            <button
              ref={(element) => registerItemRef(itemKey, element)}
              type="button"
              onClick={() => onToggleDir(node.fullPath)}
              onFocus={() => onItemFocus(itemKey)}
              onKeyDown={(event) => onItemKeyDown(itemKey, event)}
              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              data-active={activeItemKey === itemKey}
              style={{ paddingLeft: 8 + depth * 14 }}
              aria-expanded={isExpanded}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center text-xs text-slate-400 group-hover:text-slate-700">
                {isExpanded ? '▾' : '▸'}
              </span>
              <span className="truncate font-medium">{node.name}</span>
            </button>
            {isExpanded ? <div>{renderNodes(node.children, depth + 1)}</div> : null}
          </div>
        );
      }

      const isActive = node.file.id === selectedFileId;
      const itemKey = getFileKey(node.file.id);
      return (
        <button
          ref={(element) => registerItemRef(itemKey, element)}
          key={itemKey}
          type="button"
          onClick={() => onSelectFile(node.file)}
          onFocus={() => onItemFocus(itemKey)}
          onKeyDown={(event) => onItemKeyDown(itemKey, event)}
          title={node.fullPath}
          className={
            'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ' +
            (isActive
              ? 'bg-slate-100 text-slate-900 ring-1 ring-inset ring-slate-300 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
          }
          data-active={activeItemKey === itemKey}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <span className="inline-flex max-w-full items-center gap-2">
            <span className="text-slate-400">#</span>
            <span className="truncate">{node.name}</span>
          </span>
        </button>
      );
    });
  };

  return <div className="space-y-0.5">{renderNodes(nodes)}</div>;
});

function SubmissionDetailPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [viewState, setViewState] = useState<ViewState>('idle');
  const [submission, setSubmission] = useState<PersonalSubmission | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [activeTreeItemKey, setActiveTreeItemKey] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [editorValue, setEditorValue] = useState<string>('');
  const [editorLanguage, setEditorLanguage] = useState<string>('plaintext');

  const [fileError, setFileError] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set<string>());

  const fileRequestIdRef = useRef(0);
  const fileContentCacheRef = useRef<Record<number, string>>({});
  const treeItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const submissionId = useMemo(() => {
    const raw = router.query.id;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [router.query.id]);

  const isOwner = useMemo(() => {
    if (!submission?.owner?.email || !user?.email) return false;
    return submission.owner.email === user.email;
  }, [submission?.owner?.email, user?.email]);

  const fileTree = useMemo(() => {
    const files = submission?.files ?? [];
    return buildFileTree(files);
  }, [submission?.files]);

  const flatFiles = useMemo(() => flattenFiles(fileTree), [fileTree]);
  const visibleTreeItems = useMemo(
    () => flattenVisibleTree(fileTree, expandedPaths),
    [expandedPaths, fileTree]
  );

  const canView = useMemo(() => {
    if (!submission) return false;
    if (submission.visibility === 'public') return true;
    if (submission.visibility === 'private') return isOwner;
    return false;
  }, [submission, isOwner]);

  const openFile = useCallback(
    async (file: PersonalSubmissionFile) => {
      if (!submissionId) return;

      const displayPath = getDisplayPath(file);
      const cacheHit = fileContentCacheRef.current[file.id];

      setSelectedFileId(file.id);
      setSelectedFilePath(displayPath);
      setEditorLanguage(languageFromFilename(displayPath));
      setFileError(null);

      if (cacheHit != null) {
        setEditorValue(cacheHit);
        return;
      }

      const requestId = fileRequestIdRef.current + 1;
      fileRequestIdRef.current = requestId;

      setLoadingFile(true);
      try {
        const content = await getFileContent(submissionId, file.id);

        if (fileRequestIdRef.current !== requestId) return;

        fileContentCacheRef.current = {
          ...fileContentCacheRef.current,
          [file.id]: content,
        };
        setEditorValue(content);
      } catch {
        if (fileRequestIdRef.current !== requestId) return;

        setEditorValue('');
        setFileError('Unable to load this file content. Please try again.');
      } finally {
        if (fileRequestIdRef.current === requestId) {
          setLoadingFile(false);
        }
      }
    },
    [submissionId]
  );

  const handleToggleDir = useCallback((fullPath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(fullPath)) {
        next.delete(fullPath);
      } else {
        next.add(fullPath);
      }
      return next;
    });
  }, []);

  const registerTreeItemRef = useCallback(
    (key: string, element: HTMLButtonElement | null) => {
      if (element) {
        treeItemRefs.current.set(key, element);
      } else {
        treeItemRefs.current.delete(key);
      }
    },
    []
  );

  const focusTreeItem = useCallback((key: string) => {
    setActiveTreeItemKey(key);
    requestAnimationFrame(() => {
      treeItemRefs.current.get(key)?.focus();
    });
  }, []);

  const handleTreeItemFocus = useCallback((key: string) => {
    setActiveTreeItemKey(key);
  }, []);

  const handleTreeItemKeyDown = useCallback(
    (itemKey: string, event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (visibleTreeItems.length === 0) return;

      const currentIndex = visibleTreeItems.findIndex((item) => item.key === itemKey);
      if (currentIndex === -1) return;

      const currentItem = visibleTreeItems[currentIndex];

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextItem = visibleTreeItems[currentIndex + 1];
        if (nextItem) focusTreeItem(nextItem.key);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const previousItem = visibleTreeItems[currentIndex - 1];
        if (previousItem) focusTreeItem(previousItem.key);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();

        if (currentItem.kind === 'dir') {
          if (!currentItem.isExpanded) {
            handleToggleDir(currentItem.fullPath);
            return;
          }

          const childCandidate = visibleTreeItems[currentIndex + 1];
          if (
            childCandidate &&
            childCandidate.parentKey === currentItem.key &&
            childCandidate.depth === currentItem.depth + 1
          ) {
            focusTreeItem(childCandidate.key);
          }
        }
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();

        if (currentItem.kind === 'dir' && currentItem.isExpanded) {
          handleToggleDir(currentItem.fullPath);
          return;
        }

        if (currentItem.parentKey) {
          focusTreeItem(currentItem.parentKey);
        }
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();

        if (currentItem.kind === 'dir') {
          handleToggleDir(currentItem.fullPath);
          return;
        }

        if (currentItem.file) {
          void openFile(currentItem.file);
        }
      }
    },
    [focusTreeItem, handleToggleDir, openFile, visibleTreeItems]
  );

  const handleDelete = useCallback(async () => {
    if (!submissionId || !isOwner || isDeleting) return;

    const confirmed = window.confirm(
      'Delete this submission? This action cannot be undone.'
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteSubmission(submissionId);
      await router.push('/submissions');
    } catch {
      window.alert('Failed to delete submission. Please retry.');
      setIsDeleting(false);
    }
  }, [isDeleting, isOwner, router, submissionId]);

  useEffect(() => {
    if (!router.isReady) return;

    if (!submissionId) {
      setViewState('error');
      setSubmission(null);
      setSubmissionError('Invalid submission id.');
      return;
    }

    let cancelled = false;

    const loadSubmission = async () => {
      setViewState('loading');
      setSubmissionError(null);

      try {
        const data = await getSubmission(submissionId);
        if (cancelled) return;

        setSubmission(data);
        setViewState('ready');
      } catch (error) {
        if (cancelled) return;

        if (axios.isAxiosError(error) && error.response?.status === 403) {
          setViewState('forbidden');
          setSubmission(null);
          return;
        }

        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setSubmissionError('Submission not found.');
        } else {
          setSubmissionError('Failed to load submission. Please try again.');
        }
        setSubmission(null);
        setViewState('error');
      }
    };

    loadSubmission();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, submissionId]);

  useEffect(() => {
    if (!submission) return;

    setSelectedFileId(null);
    setActiveTreeItemKey(null);
    setSelectedFilePath('');
    setEditorValue('');
    setEditorLanguage('plaintext');
    setFileError(null);
    setLoadingFile(false);
    fileContentCacheRef.current = {};

    const initialExpanded = new Set<string>();

    const markTopLevelDirs = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        if (node.kind === 'dir') {
          initialExpanded.add(node.fullPath);
        }
      });
    };

    markTopLevelDirs(fileTree);
    setExpandedPaths(initialExpanded);
  }, [fileTree, submission]);

  useEffect(() => {
    if (!submission || flatFiles.length === 0) return;
    if (selectedFileId != null) return;

    const firstFile = flatFiles[0];
    void openFile(firstFile.file);
  }, [flatFiles, openFile, selectedFileId, submission]);

  useEffect(() => {
    if (visibleTreeItems.length === 0) {
      setActiveTreeItemKey(null);
      return;
    }

    if (activeTreeItemKey) {
      const exists = visibleTreeItems.some((item) => item.key === activeTreeItemKey);
      if (exists) return;
    }

    if (selectedFileId != null) {
      const selectedKey = getFileKey(selectedFileId);
      const selectedVisible = visibleTreeItems.some((item) => item.key === selectedKey);
      if (selectedVisible) {
        setActiveTreeItemKey(selectedKey);
        return;
      }
    }

    setActiveTreeItemKey(visibleTreeItems[0].key);
  }, [activeTreeItemKey, selectedFileId, visibleTreeItems]);

  const navigateBack = useCallback(() => {
    void router.push('/submissions');
  }, [router]);

  if (viewState === 'loading' || viewState === 'idle') {
    return (
      <div className="min-h-screen bg-linear-to-b from-white via-slate-50 to-white">
        <Header activePage="Submissions" />
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
          <HeaderSkeleton />
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="h-130 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            <div className="h-130 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'forbidden') {
    return (
      <div className="min-h-screen bg-linear-to-b from-white via-slate-50 to-white text-slate-900">
        <Header activePage="Submissions" />
        <div className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-sm">
            <BackButton onClick={navigateBack} />
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">403</h1>
            <p className="mt-2 text-sm text-slate-600">
            You do not have permission to view this submission.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'error' || !submission) {
    return (
      <div className="min-h-screen bg-linear-to-b from-white via-slate-50 to-white text-slate-900">
        <Header activePage="Submissions" />
        <div className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-sm">
            <BackButton onClick={navigateBack} />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">
              Unable to load submission
            </h1>
            <p className="mt-2 text-sm text-slate-600">{submissionError ?? 'Unknown error.'}</p>
          </div>
        </div>
      </div>
    );
  }



  if (!canView) {
    return (
      <div className="min-h-screen bg-linear-to-b from-white via-slate-50 to-white text-slate-900">
        <Header activePage="Submissions" />
        <div className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-sm">
            <BackButton onClick={navigateBack} />
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">403</h1>
            <p className="mt-2 text-sm text-slate-600">
              This submission is private and can only be viewed by its owner.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectedFileMeta =
    submission.files?.find((file) => file.id === selectedFileId) ?? null;

  return (
    <>
      <Head>
        <title>{submission.title} - Submission - ESICodeHub</title>
      </Head>

      <div className="min-h-screen bg-linear-to-b from-white via-slate-50 to-white text-slate-900">
        <Header activePage="Submissions" />
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <header className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <BackButton onClick={navigateBack} />

                  <h1 className="mt-4 truncate text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                    {submission.title}
                  </h1>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge label={submission.language} />
                    <Badge label={submission.submission_type} />
                    <Badge label={submission.visibility} />
                    <Badge label={timeAgo(submission.created_at)} />
                    {submission.owner ? (
                      <Badge
                        label={`${submission.owner.first_name} ${submission.owner.last_name}`}
                      />
                    ) : null}
                  </div>
                </div>

                {isOwner ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/submissions/${submission.id}/edit`)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ) : null}
              </div>

              {submission.description ? (
                <p className="max-w-4xl text-sm leading-7 text-slate-600">{submission.description}</p>
              ) : null}
            </div>
          </header>

          <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="h-[44vh] min-h-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md lg:h-[72vh]">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Explorer
                </h2>
              </div>
              <div className="h-[calc(44vh-53px)] overflow-y-auto px-2 py-2 lg:h-[calc(72vh-53px)]">
                {(submission.files?.length ?? 0) === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                    No files attached to this submission.
                  </div>
                ) : (
                  <FileTree
                    nodes={fileTree}
                    selectedFileId={selectedFileId}
                    activeItemKey={activeTreeItemKey}
                    expandedPaths={expandedPaths}
                    onToggleDir={handleToggleDir}
                    onSelectFile={openFile}
                    onItemFocus={handleTreeItemFocus}
                    onItemKeyDown={handleTreeItemKeyDown}
                    registerItemRef={registerTreeItemRef}
                  />
                )}
              </div>
            </aside>

            <section className="h-[52vh] min-h-90 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md lg:h-[72vh]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {selectedFilePath || 'Select a file'}
                  </p>
                  {selectedFileMeta ? (
                    <p className="text-xs text-slate-500">
                      {formatFileSize(selectedFileMeta.file_size)}
                    </p>
                  ) : null}
                </div>
                {fileError ? <p className="text-xs text-rose-600">{fileError}</p> : null}
              </div>

              <div className="relative h-[calc(52vh-57px)] lg:h-[calc(72vh-57px)]">
                {loadingFile ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 backdrop-blur-[1px]">
                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                      Loading file...
                    </div>
                  </div>
                ) : null}

                {selectedFileId == null ? (
                  <div className="flex h-full items-center justify-center px-4 text-center">
                    <div>
                      <p className="text-base font-semibold text-slate-700">No file selected</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Choose a file from the explorer to preview its source code.
                      </p>
                    </div>
                  </div>
                ) : (
                  <MonacoEditor
                    height="100%"
                    theme="vs-dark"
                    language={editorLanguage}
                    value={editorValue}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      fontSize: 13,
                      lineNumbersMinChars: 3,
                      renderLineHighlight: 'all',
                      automaticLayout: true,
                    }}
                  />
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SubmissionDetailPageWrapper() {
  return (
    <ProtectedRoute>
      <SubmissionDetailPage />
    </ProtectedRoute>
  );
}
