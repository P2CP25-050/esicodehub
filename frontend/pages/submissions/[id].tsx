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
    case 'py': return 'python';
    case 'js': case 'mjs': case 'cjs': case 'jsx': return 'javascript';
    case 'ts': case 'mts': case 'cts': case 'tsx': return 'typescript';
    case 'c': case 'h': return 'c';
    case 'cpp': case 'cc': case 'cxx': case 'hpp': case 'hh': case 'hxx': return 'cpp';
    case 'java': return 'java';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'sh': case 'bash': return 'shell';
    case 'yml': case 'yaml': return 'yaml';
    case 'xml': return 'xml';
    default: return 'plaintext';
  }
};

const flattenFiles = (nodes: TreeNode[]): TreeFileNode[] => {
  const out: TreeFileNode[] = [];
  const traverse = (items: TreeNode[]) => {
    items.forEach((item) => {
      if (item.kind === 'file') out.push(item);
      else traverse(item.children);
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
  const visit = (items: TreeNode[], depth: number, parentKey: string | null) => {
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
        if (isExpanded) visit(item.children, depth + 1, dirKey);
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

// ---------- Design System Components (pure CSS classes) ----------
const Badge = ({ label }: { label: string }) => (
  <span className="detail-badge">{label}</span>
);

const HeaderSkeleton = () => (
  <div className="detail-card animate-pulse p-5">
    <div className="h-5 w-24 rounded bg-slate-200" />
    <div className="mt-4 h-8 w-2/3 rounded bg-slate-200" />
    <div className="mt-3 flex gap-2">
      <div className="h-6 w-20 rounded bg-slate-200" />
      <div className="h-6 w-20 rounded bg-slate-200" />
      <div className="h-6 w-20 rounded bg-slate-200" />
    </div>
  </div>
);

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="detail-back-btn group"
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className="detail-back-icon"
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
              className="detail-tree-btn"
              data-active={activeItemKey === itemKey}
              style={{ paddingLeft: 8 + depth * 14 }}
              aria-expanded={isExpanded}
            >
              <span className="detail-tree-arrow">{isExpanded ? '▾' : '▸'}</span>
              <span className="detail-tree-dirname">{node.name}</span>
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
          className={`detail-tree-file ${isActive ? 'detail-tree-file-active' : ''}`}
          data-active={activeItemKey === itemKey}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <span className="detail-tree-file-icon">#</span>
          <span className="detail-tree-filename">{node.name}</span>
        </button>
      );
    });
  };
  return <div className="detail-tree-container">{renderNodes(nodes)}</div>;
});

// ---------- Main Page Component ----------
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
        fileContentCacheRef.current = { ...fileContentCacheRef.current, [file.id]: content };
        setEditorValue(content);
      } catch {
        if (fileRequestIdRef.current !== requestId) return;
        setEditorValue('');
        setFileError('Unable to load this file content. Please try again.');
      } finally {
        if (fileRequestIdRef.current === requestId) setLoadingFile(false);
      }
    },
    [submissionId]
  );

  const handleToggleDir = useCallback((fullPath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(fullPath)) next.delete(fullPath);
      else next.add(fullPath);
      return next;
    });
  }, []);

  const registerTreeItemRef = useCallback((key: string, element: HTMLButtonElement | null) => {
    if (element) treeItemRefs.current.set(key, element);
    else treeItemRefs.current.delete(key);
  }, []);

  const focusTreeItem = useCallback((key: string) => {
    setActiveTreeItemKey(key);
    requestAnimationFrame(() => treeItemRefs.current.get(key)?.focus());
  }, []);

  const handleTreeItemFocus = useCallback((key: string) => setActiveTreeItemKey(key), []);
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
          if (childCandidate && childCandidate.parentKey === currentItem.key && childCandidate.depth === currentItem.depth + 1) {
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
        if (currentItem.parentKey) focusTreeItem(currentItem.parentKey);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (currentItem.kind === 'dir') handleToggleDir(currentItem.fullPath);
        else if (currentItem.file) void openFile(currentItem.file);
      }
    },
    [focusTreeItem, handleToggleDir, openFile, visibleTreeItems]
  );

  const handleDelete = useCallback(async () => {
    if (!submissionId || !isOwner || isDeleting) return;
    const confirmed = window.confirm('Delete this submission? This action cannot be undone.');
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

  // Fetch submission
  useEffect(() => {
    if (!router.isReady) return;
    if (!submissionId) {
      setViewState('error');
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
    return () => { cancelled = true; };
  }, [router.isReady, submissionId]);

  // Reset on new submission
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
        if (node.kind === 'dir') initialExpanded.add(node.fullPath);
      });
    };
    markTopLevelDirs(fileTree);
    setExpandedPaths(initialExpanded);
  }, [fileTree, submission]);

  // Auto-select first file
  useEffect(() => {
    if (!submission || flatFiles.length === 0) return;
    if (selectedFileId != null) return;
    const firstFile = flatFiles[0];
    void openFile(firstFile.file);
  }, [flatFiles, openFile, selectedFileId, submission]);

  // Sync active tree item with visible items
  useEffect(() => {
    if (visibleTreeItems.length === 0) {
      setActiveTreeItemKey(null);
      return;
    }
    if (activeTreeItemKey && visibleTreeItems.some((item) => item.key === activeTreeItemKey)) return;
    if (selectedFileId != null) {
      const selectedKey = getFileKey(selectedFileId);
      if (visibleTreeItems.some((item) => item.key === selectedKey)) {
        setActiveTreeItemKey(selectedKey);
        return;
      }
    }
    setActiveTreeItemKey(visibleTreeItems[0].key);
  }, [activeTreeItemKey, selectedFileId, visibleTreeItems]);

  const navigateBack = useCallback(() => router.push('/submissions'), [router]);

  // Inject global styles (same as new.tsx pattern)
  useEffect(() => {
    if (typeof document !== "undefined") {
      const id = "detail-page-styles";
      if (!document.getElementById(id)) {
        const style = document.createElement("style");
        style.id = id;
        style.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
          :root {
            --ink: #000000;
            --paper: #ffffff;
            --navy: #051650;
            --rule: 1.5px solid #000;
            --font-display: 'Playfair Display', Georgia, serif;
            --font-mono: 'Space Mono', monospace;
            --font-body: 'DM Sans', sans-serif;
          }
          .detail-page {
            min-height: 100vh;
            background: var(--paper);
            font-family: var(--font-body);
            color: var(--ink);
            position: relative;
          }
          .detail-page::before {
            content: '';
            position: fixed;
            top: 0;
            right: 0;
            width: 340px;
            height: 100vh;
            background: var(--navy);
            clip-path: polygon(60px 0, 100% 0, 100% 100%, 0 100%);
            z-index: 0;
            pointer-events: none;
          }
          .detail-container {
            max-width: 1180px;
            margin: 0 auto;
            padding: 40px 28px 80px;
            position: relative;
            z-index: 1;
          }
          .detail-card {
            background: var(--paper);
            border: var(--rule);
            border-top: 4px solid var(--navy);
            padding: 32px;
            position: relative;
          }
          .detail-card::after {
            content: '';
            position: absolute;
            bottom: -1px;
            right: -1px;
            width: 24px;
            height: 24px;
            border-bottom: 4px solid var(--navy);
            border-right: 4px solid var(--navy);
          }
          .detail-back-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border-radius: 6px;
            border: 1.5px solid rgba(0,0,0,0.15);
            background: white;
            padding: 8px 16px;
            font-family: var(--font-mono);
            font-size: 12px;
            font-weight: 700;
            color: black;
            transition: all 0.2s;
            cursor: pointer;
          }
          .detail-back-btn:hover {
            transform: translateY(-2px);
            border-color: rgba(0,0,0,0.3);
            box-shadow: 3px 3px 0 #051650;
          }
          .detail-back-icon {
            color: rgba(0,0,0,0.5);
            transition: transform 0.2s;
          }
          .detail-back-btn:hover .detail-back-icon {
            transform: translateX(-2px);
          }
          .detail-badge {
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            border: 1px solid rgba(0,0,0,0.1);
            background: white;
            padding: 0.25rem 0.75rem;
            font-family: var(--font-mono);
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--navy);
          }
          .detail-tree-container {
            display: flex;
            flex-direction: column;
            gap: 0.125rem;
          }
          .detail-tree-btn {
            display: flex;
            width: 100%;
            align-items: center;
            gap: 8px;
            border-radius: 6px;
            padding: 6px 8px;
            text-align: left;
            font-size: 0.875rem;
            color: rgba(0,0,0,0.7);
            transition: all 0.15s;
            background: transparent;
            border: none;
            cursor: pointer;
          }
          .detail-tree-btn:hover {
            background: rgba(0,0,0,0.05);
            color: black;
          }
          .detail-tree-arrow {
            display: inline-flex;
            height: 16px;
            width: 16px;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: rgba(0,0,0,0.4);
          }
          .detail-tree-dirname {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: var(--font-mono);
            font-weight: 500;
          }
          .detail-tree-file {
            width: 100%;
            border-radius: 6px;
            padding: 6px 8px;
            text-align: left;
            font-size: 0.875rem;
            transition: all 0.15s;
            color: rgba(0,0,0,0.7);
            background: transparent;
            border: none;
            cursor: pointer;
          }
          .detail-tree-file:hover {
            background: rgba(0,0,0,0.05);
            color: black;
          }
          .detail-tree-file-active {
            background: rgba(0,0,0,0.05);
            color: black;
            box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2);
          }
          .detail-tree-file-icon {
            margin-right: 8px;
            color: rgba(0,0,0,0.4);
          }
          .detail-tree-filename {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: var(--font-mono);
          }
          .detail-editor-loader {
            position: absolute;
            inset: 0;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.75);
            backdrop-filter: blur(1px);
          }
          .detail-spinner {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border-radius: 6px;
            border: 1px solid rgba(0,0,0,0.15);
            background: white;
            padding: 6px 12px;
            font-size: 0.875rem;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          }
          .detail-spinner-icon {
            height: 16px;
            width: 16px;
            animation: spin 1s linear infinite;
            border-radius: 999px;
            border: 2px solid rgba(0,0,0,0.2);
            border-top-color: #051650;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @media (max-width: 900px) {
            .detail-page::before { display: none; }
            .detail-card { padding: 20px; }
            .detail-container { padding: 20px 16px; }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  // Render loading state
  if (viewState === 'loading' || viewState === 'idle') {
    return (
      <div className="detail-page">
        <Header activePage="Submissions" />
        <div className="detail-container space-y-4">
          <HeaderSkeleton />
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="detail-card h-130 animate-pulse" />
            <div className="detail-card h-130 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'forbidden' || (viewState === 'error' && !submission)) {
    return (
      <div className="detail-page">
        <Header activePage="Submissions" />
        <div className="detail-container">
          <div className="detail-card max-w-3xl mx-auto">
            <BackButton onClick={navigateBack} />
            <h1 className="mt-6 text-3xl font-(--font-display) text-black">403</h1>
            <p className="mt-2 text-sm text-black/70">
              {viewState === 'forbidden'
                ? 'You do not have permission to view this submission.'
                : submissionError ?? 'Unknown error.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="detail-page">
        <Header activePage="Submissions" />
        <div className="detail-container">
          <div className="detail-card max-w-3xl mx-auto">
            <BackButton onClick={navigateBack} />
            <h1 className="mt-6 text-3xl font-(--font-display) text-black">403</h1>
            <p className="mt-2 text-sm text-black/70">This submission is private and can only be viewed by its owner.</p>
          </div>
        </div>
      </div>
    );
  }

  //  TYPESCRIPT GUARD: after all error/forbidden checks, submission must be non‑null
  if (!submission) return null;

  const selectedFileMeta = submission.files?.find((file) => file.id === selectedFileId) ?? null;

  return (
    <>
      <Head><title>{submission.title} - Submission - ESICodeHub</title></Head>
      <div className="detail-page">
        <Header activePage="Submissions" />
        <div className="detail-container">
          {/* Header card */}
          <div className="detail-card mb-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <BackButton onClick={navigateBack} />
                  <h1 className="mt-4 text-2xl font-(--font-display) tracking-tight sm:text-3xl">{submission.title}</h1>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge label={submission.language} />
                    <Badge label={submission.submission_type} />
                    <Badge label={submission.visibility} />
                    <Badge label={timeAgo(submission.created_at)} />
                    {submission.owner && (
                      <Badge label={`${submission.owner.first_name} ${submission.owner.last_name}`} />
                    )}
                  </div>
                </div>
                {isOwner && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/submissions/${submission.id}/edit`)}
                      className="detail-back-btn"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="detail-back-btn border-red-500! text-red-600! hover:bg-red-50!"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
              {submission.description && <p className="max-w-4xl text-sm leading-7 text-black/70">{submission.description}</p>}
            </div>
          </div>

          {/* Two‑column layout */}
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            {/* File tree */}
            <div className="detail-card h-[44vh] overflow-hidden lg:h-[72vh] flex flex-col">
              <div className="border-b border-black/10 px-4 py-3">
                <h2 className="text-xs font-mono font-bold uppercase tracking-[0.14em] text-[#051650]">Explorer</h2>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {submission.files?.length === 0 ? (
                  <div className="rounded-md border border-black/10 bg-black/5 px-3 py-6 text-center text-sm text-black/50">
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
            </div>

            {/* Monaco editor */}
            <div className="detail-card h-[52vh] overflow-hidden lg:h-[72vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold font-mono">{selectedFilePath || 'Select a file'}</p>
                  {selectedFileMeta && <p className="text-xs text-black/50">{formatFileSize(selectedFileMeta.file_size)}</p>}
                </div>
                {fileError && <p className="text-xs text-red-600">{fileError}</p>}
              </div>
              <div className="relative flex-1">
                {loadingFile && (
                  <div className="detail-editor-loader">
                    <div className="detail-spinner">
                      <div className="detail-spinner-icon" />
                      Loading file...
                    </div>
                  </div>
                )}
                {selectedFileId == null ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <p className="text-base font-semibold">No file selected</p>
                      <p className="mt-1 text-sm text-black/50">Choose a file from the explorer to preview its source code.</p>
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
            </div>
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