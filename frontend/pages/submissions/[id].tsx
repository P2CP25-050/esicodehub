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
import type { IDisposable, editor as MonacoEditorNS } from 'monaco-editor';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import Header from '@/components/submissions/Header';
import { useAuth } from '@/context/AuthContext';
import type {
  PersonalSubmission,
  SubmissionComment,
  PersonalSubmissionFile,
} from '@/services/submissions/submissions.types';
import {
  createSubmissionComment,
  deleteSubmissionComment,
  deleteSubmission,
  getFileContent,
  listSubmissionComments,
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

const getInitials = (fullName: string): string => {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return 'U';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
};

const normalizeComments = (comments: SubmissionComment[]): SubmissionComment[] => {
  return [...comments].sort((a, b) => {
    if (a.line_number !== b.line_number) {
      return a.line_number - b.line_number;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
};

const getCommentAuthorName = (comment: SubmissionComment): string => {
  if (comment.author_name?.trim()) return comment.author_name.trim();

  const first = comment.author?.first_name?.trim() ?? '';
  const last = comment.author?.last_name?.trim() ?? '';
  const full = `${first} ${last}`.trim();
  if (full) return full;

  if (comment.author_email?.trim()) return comment.author_email.trim();
  if (comment.author?.email?.trim()) return comment.author.email.trim();
  return 'User';
};

const getCommentAuthorAvatar = (comment: SubmissionComment): string | null => {
  return comment.author_avatar ?? comment.author?.avatar ?? null;
};

const getCommentAuthorEmail = (comment: SubmissionComment): string | null => {
  return comment.author_email ?? comment.author?.email ?? null;
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
  const [comments, setComments] = useState<SubmissionComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState<boolean>(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [activeThreadLine, setActiveThreadLine] = useState<number | null>(null);
  const [hoverCommentLine, setHoverCommentLine] = useState<number | null>(null);
  const [activeThreadDraft, setActiveThreadDraft] = useState<string>('');
  const [activeThreadTop, setActiveThreadTop] = useState<number | null>(null);
  const [postingComment, setPostingComment] = useState<boolean>(false);
  const [deletingCommentIds, setDeletingCommentIds] = useState<Set<number>>(new Set());
  const [threadZoneVersion, setThreadZoneVersion] = useState(0);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set<string>());

  const fileRequestIdRef = useRef(0);
  const fileContentCacheRef = useRef<Record<number, string>>({});
  const treeItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const editorDisposablesRef = useRef<IDisposable[]>([]);
  const commentDecorationIdsRef = useRef<string[]>([]);
  const commentZoneIdRef = useRef<string | null>(null);
  const commentDraftByLineRef = useRef<Record<number, string>>({});

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

  const commentsByLine = useMemo(() => {
    const map = new Map<number, SubmissionComment[]>();
    comments.forEach((comment) => {
      if (!map.has(comment.line_number)) {
        map.set(comment.line_number, []);
      }
      map.get(comment.line_number)?.push(comment);
    });
    return map;
  }, [comments]);

  const commentLines = useMemo(() => {
    return Array.from(commentsByLine.keys()).sort((a, b) => a - b);
  }, [commentsByLine]);

  const isOwnComment = useCallback(
    (comment: SubmissionComment): boolean => {
      if (!user?.email) return false;
      const authorEmail = getCommentAuthorEmail(comment);
      return Boolean(authorEmail && authorEmail === user.email);
    },
    [user?.email]
  );

  const clearThreadZone = useCallback(() => {
    const editor = editorRef.current;
    const zoneId = commentZoneIdRef.current;
    if (!editor || !zoneId) return;

    editor.changeViewZones((accessor) => {
      accessor.removeZone(zoneId);
    });
    commentZoneIdRef.current = null;
  }, []);

  const updateThreadOverlayPosition = useCallback((lineNumber: number) => {
    const editor = editorRef.current;
    if (!editor) {
      setActiveThreadTop(null);
      return;
    }

    const visiblePosition = editor.getScrolledVisiblePosition({ lineNumber, column: 1 });
    if (!visiblePosition) {
      setActiveThreadTop(null);
      return;
    }

    setActiveThreadTop(visiblePosition.top + visiblePosition.height + 12);
  }, []);

  const refreshCommentDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco) return;

    if (selectedFileId == null) {
      commentDecorationIdsRef.current = editor.deltaDecorations(
        commentDecorationIdsRef.current,
        []
      );
      return;
    }

    const decorationLines = new Set<number>(commentLines);
    if (hoverCommentLine != null && !decorationLines.has(hoverCommentLine)) {
      decorationLines.add(hoverCommentLine);
    }

    const decorations = Array.from(decorationLines)
      .sort((a, b) => a - b)
      .map((lineNumber) => {
        const hasComment = commentsByLine.has(lineNumber);
        const isHoverLine = hoverCommentLine === lineNumber && !hasComment;

        return {
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className:
              activeThreadLine === lineNumber
                ? 'submission-comment-line submission-comment-line-active'
                : isHoverLine
                  ? 'submission-comment-line submission-comment-line-hover'
                  : 'submission-comment-line',
            glyphMarginClassName: isHoverLine
              ? 'submission-comment-hover-glyph'
              : 'submission-comment-glyph',
            glyphMarginHoverMessage: {
              value: isHoverLine ? 'Add comment' : 'Open comment thread',
            },
          },
        };
      });

    commentDecorationIdsRef.current = editor.deltaDecorations(
      commentDecorationIdsRef.current,
      decorations
    );
  }, [activeThreadLine, commentsByLine, commentLines, hoverCommentLine, selectedFileId]);

  const openThreadAtLine = useCallback(
    (lineNumber: number) => {
      const editor = editorRef.current;
      if (!editor || selectedFileId == null) return;

      const model = editor.getModel();
      const maxLine = Math.max(1, model?.getLineCount() ?? 1);
      const safeLine = Math.min(Math.max(1, Math.floor(lineNumber)), maxLine);

      editor.setPosition({ lineNumber: safeLine, column: 1 });
      editor.revealLineInCenter(safeLine);

      setActiveThreadDraft(commentDraftByLineRef.current[safeLine] ?? '');
      setActiveThreadLine(safeLine);
      setThreadZoneVersion((prev) => prev + 1);
      updateThreadOverlayPosition(safeLine);
    },
    [selectedFileId, updateThreadOverlayPosition]
  );

  const addCommentAtActiveLine = useCallback(async () => {
    if (!submissionId || activeThreadLine == null || !canView) return;

    const body = activeThreadDraft.trim();
    if (!body) {
      setCommentsError('Comment body cannot be empty.');
      return;
    }

    setCommentsError(null);
    setPostingComment(true);

    try {
      const created = await createSubmissionComment(submissionId, {
        line_number: activeThreadLine,
        body,
      });

      commentDraftByLineRef.current[activeThreadLine] = '';
      setActiveThreadDraft('');
      setComments((prev) => normalizeComments([...prev, created]));
      setThreadZoneVersion((prev) => prev + 1);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        setCommentsError('You are not allowed to comment on this submission.');
      } else {
        setCommentsError('Failed to post comment. Please try again.');
      }
    } finally {
      setPostingComment(false);
    }
  }, [activeThreadDraft, activeThreadLine, submissionId, canView]);

  const handleDeleteComment = useCallback(
    async (commentId: number) => {
      if (!submissionId) return;

      setDeletingCommentIds((prev) => {
        const next = new Set(prev);
        next.add(commentId);
        return next;
      });

      try {
        await deleteSubmissionComment(submissionId, commentId);
        setComments((prev) => prev.filter((comment) => comment.id !== commentId));
        setThreadZoneVersion((prev) => prev + 1);
      } catch {
        setCommentsError('Failed to delete comment. Please try again.');
      } finally {
        setDeletingCommentIds((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
      }
    },
    [submissionId]
  );

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
    if (!submissionId || !canView) return;

    let cancelled = false;

    const loadComments = async () => {
      setCommentsLoading(true);
      setCommentsError(null);

      try {
        const data = await listSubmissionComments(submissionId);
        if (cancelled) return;
        setComments(normalizeComments(data));
      } catch (error) {
        if (cancelled) return;

        if (axios.isAxiosError(error) && error.response?.status === 403) {
          setCommentsError('Comments are not available for this submission.');
        } else {
          setCommentsError('Unable to load comments.');
        }
        setComments([]);
      } finally {
        if (!cancelled) {
          setCommentsLoading(false);
        }
      }
    };

    void loadComments();

    return () => {
      cancelled = true;
    };
  }, [canView, submissionId]);

  useEffect(() => {
    if (!submission) return;

    setSelectedFileId(null);
    setActiveTreeItemKey(null);
    setSelectedFilePath('');
    setEditorValue('');
    setEditorLanguage('plaintext');
    setFileError(null);
    setLoadingFile(false);
    setComments([]);
    setActiveThreadLine(null);
    setHoverCommentLine(null);
    setActiveThreadDraft('');
    setActiveThreadTop(null);
    setCommentsError(null);
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
    setActiveThreadLine(null);
    setHoverCommentLine(null);
    setActiveThreadDraft('');
    setActiveThreadTop(null);
    clearThreadZone();
  }, [clearThreadZone, selectedFileId]);

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

  useEffect(() => {
    refreshCommentDecorations();
  }, [refreshCommentDecorations]);

  useEffect(() => {
    if (activeThreadLine == null) {
      setActiveThreadTop(null);
      clearThreadZone();
      return;
    }

    const editor = editorRef.current;
    if (!editor || selectedFileId == null) {
      setActiveThreadTop(null);
      clearThreadZone();
      return;
    }

    const lineComments = commentsByLine.get(activeThreadLine) ?? [];
    const heightInPx = Math.min(460, Math.max(170, 126 + lineComments.length * 84));

    clearThreadZone();
    editor.changeViewZones((accessor) => {
      commentZoneIdRef.current = accessor.addZone({
        afterLineNumber: activeThreadLine,
        heightInPx,
        domNode: document.createElement('div'),
      });
    });

    updateThreadOverlayPosition(activeThreadLine);

    const updatePosition = () => {
      updateThreadOverlayPosition(activeThreadLine);
    };

    const scrollDisposable = editor.onDidScrollChange(updatePosition);
    const layoutDisposable = editor.onDidLayoutChange(updatePosition);

    return () => {
      scrollDisposable.dispose();
      layoutDisposable.dispose();
      clearThreadZone();
    };
  }, [
    activeThreadLine,
    clearThreadZone,
    commentsByLine,
    selectedFileId,
    threadZoneVersion,
    updateThreadOverlayPosition,
  ]);

  useEffect(() => {
    return () => {
      clearThreadZone();
      editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
      editorDisposablesRef.current = [];
    };
  }, [clearThreadZone]);

  const handleEditorMount: EditorProps['onMount'] = useCallback(
    (
      editor: MonacoEditorNS.IStandaloneCodeEditor,
      monaco: typeof import('monaco-editor')
    ) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
      editorDisposablesRef.current = [];

      const onMouseDown = editor.onMouseDown((event: MonacoEditorNS.IEditorMouseEvent) => {
        if (selectedFileId == null) return;

        const lineNumber = event.target.position?.lineNumber;
        if (!lineNumber) return;

        const targetType = event.target.type;
        if (
          targetType === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
          targetType === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS
        ) {
          event.event.preventDefault();
          event.event.stopPropagation();
          window.setTimeout(() => {
            openThreadAtLine(lineNumber);
          }, 0);
        }
      });


      const onMouseMove = editor.onMouseMove((event: MonacoEditorNS.IEditorMouseEvent) => {
        if (selectedFileId == null) return;

        const lineNumber = event.target.position?.lineNumber;
        if (!lineNumber) {
          setHoverCommentLine(null);
          return;
        }

        setHoverCommentLine(lineNumber);
      });

      const onMouseLeave = editor.onMouseLeave(() => {
        setHoverCommentLine(null);
      });
      editorDisposablesRef.current.push(onMouseDown);
      refreshCommentDecorations();
      editorDisposablesRef.current.push(onMouseMove);
      editorDisposablesRef.current.push(onMouseLeave);
      if (activeThreadLine != null) {
        updateThreadOverlayPosition(activeThreadLine);
      }
    },
    [activeThreadLine, openThreadAtLine, refreshCommentDecorations, selectedFileId, updateThreadOverlayPosition]
  );

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
  const activeThreadComments =
    activeThreadLine != null ? commentsByLine.get(activeThreadLine) ?? [] : [];
  const activeThreadHeight =
    activeThreadLine != null
      ? Math.min(320, Math.max(220, 120 + activeThreadComments.length * 56))
      : 0;

  return (
    <>
      <Head>
        <title>{submission.title} - Submission - ESICodeHub</title>
      </Head>

      <style jsx global>{`
        .submission-comment-line {
          background: linear-gradient(
            90deg,
            rgba(59, 130, 246, 0.12),
            rgba(59, 130, 246, 0.04)
          );
        }

        .submission-comment-line-active {
          background: linear-gradient(
            90deg,
            rgba(37, 99, 235, 0.2),
            rgba(37, 99, 235, 0.06)
          );
        }

        .submission-comment-line-hover {
          background: linear-gradient(
            90deg,
            rgba(37, 99, 235, 0.08),
            rgba(37, 99, 235, 0.02)
          );
        }

        .submission-comment-glyph {
          margin-left: 3px;
          width: 16px !important;
          height: 16px !important;
          border-radius: 999px;
          border: 1px solid rgba(30, 64, 175, 0.9);
          background: linear-gradient(180deg, #eff6ff 0%, #60a5fa 55%, #1d4ed8 100%);
          position: relative;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.45) inset;
        }

        .submission-comment-glyph::before,
        .submission-comment-glyph::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          background: #ffffff;
          border-radius: 999px;
          transform: translate(-50%, -50%);
        }

        .submission-comment-glyph::before {
          width: 8px;
          height: 1.75px;
        }

        .submission-comment-glyph::after {
          width: 1.75px;
          height: 8px;
        }

        .submission-comment-hover-glyph {
          margin-left: 3px;
          width: 12px !important;
          height: 12px !important;
          position: relative;
          border-radius: 999px;
          border: 1px solid rgba(37, 99, 235, 0.55);
          background: rgba(219, 234, 254, 0.9);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7) inset;
        }

        .submission-comment-hover-glyph::before,
        .submission-comment-hover-glyph::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          background: #2563eb;
          border-radius: 999px;
          transform: translate(-50%, -50%);
        }

        .submission-comment-hover-glyph::before {
          width: 6px;
          height: 1.8px;
        }

        .submission-comment-hover-glyph::after {
          width: 1.8px;
          height: 6px;
        }
      `}</style>

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

            <section className="h-[52vh] min-h-90 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md lg:h-[72vh]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {selectedFilePath || 'Select a file'}
                  </p>
                  {selectedFileMeta ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatFileSize(selectedFileMeta.file_size)}</span>
                      <span aria-hidden="true">•</span>
                      <span>
                        {commentLines.length} commented line
                        {commentLines.length === 1 ? '' : 's'}
                      </span>
                      {commentsLoading ? <span>(loading comments...)</span> : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col items-end">
                  {fileError ? <p className="text-xs text-rose-600">{fileError}</p> : null}
                  {commentsError ? (
                    <p className="text-xs text-rose-600">{commentsError}</p>
                  ) : null}
                </div>
              </div>

              <div className="relative h-[calc(52vh-57px)] overflow-visible lg:h-[calc(72vh-57px)]">
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
                  <div className="h-full overflow-hidden rounded-b-2xl">
                    <MonacoEditor
                      height="100%"
                      theme="vs-dark"
                      onMount={handleEditorMount}
                      language={editorLanguage}
                      value={editorValue}
                      options={{
                        readOnly: true,
                        glyphMargin: true,
                        lineNumbers: 'on',
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        fontSize: 13,
                        lineNumbersMinChars: 3,
                        renderLineHighlight: 'all',
                        automaticLayout: true,
                      }}
                    />
                  </div>
                )}

                {activeThreadLine != null && activeThreadTop != null ? (
                  <div
                    className="absolute inset-x-3 z-20"
                    style={{ top: activeThreadTop }}
                  >
                    <div
                      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-200"
                      style={{ height: `${activeThreadHeight}px` }}
                    >
                      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Comment thread
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-slate-800">
                            Line {activeThreadLine}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeThreadLine != null) {
                              commentDraftByLineRef.current[activeThreadLine] = activeThreadDraft;
                            }
                            setActiveThreadLine(null);
                            setActiveThreadDraft('');
                            setActiveThreadTop(null);
                            clearThreadZone();
                          }}
                          className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
                        >
                          Close
                        </button>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                        {commentsError ? (
                          <p className="mb-2 text-sm text-rose-600">{commentsError}</p>
                        ) : null}

                        {activeThreadComments.length === 0 ? (
                          <p className="mb-2 text-sm text-slate-500">
                            No comments on this line yet.
                          </p>
                        ) : (
                          <div className="space-y-2.5">
                            {activeThreadComments.map((comment) => {
                              const avatarUrl = getCommentAuthorAvatar(comment);
                              const deleting = deletingCommentIds.has(comment.id);

                              return (
                                <article
                                  key={comment.id}
                                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2.5"
                                >
                                  <div className="flex items-start justify-between gap-2.5">
                                    <div className="flex min-w-0 items-start gap-2.5">
                                      {avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={avatarUrl}
                                          alt={getCommentAuthorName(comment)}
                                          className="h-7 w-7 rounded-full object-cover"
                                        />
                                      ) : (
                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-800">
                                          {getInitials(getCommentAuthorName(comment))}
                                        </span>
                                      )}

                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                          <p className="text-sm font-semibold text-slate-900">
                                            {getCommentAuthorName(comment)}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            {timeAgo(comment.created_at)}
                                          </p>
                                        </div>
                                        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">
                                          {comment.body}
                                        </p>
                                      </div>
                                    </div>

                                    {isOwnComment(comment) ? (
                                      <button
                                        type="button"
                                        disabled={deleting}
                                        onClick={() => {
                                          void handleDeleteComment(comment.id);
                                        }}
                                        className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {deleting ? 'Deleting...' : 'Delete'}
                                      </button>
                                    ) : null}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}

                        {canView ? (
                          <div className="mt-3 shrink-0 border-t border-slate-200 pt-3">
                            <textarea
                              value={activeThreadDraft}
                              onChange={(event) => {
                                const value = event.target.value;
                                setActiveThreadDraft(value);
                                if (activeThreadLine != null) {
                                  commentDraftByLineRef.current[activeThreadLine] = value;
                                }
                              }}
                              placeholder="Write a comment…"
                              rows={2}
                              className="h-16 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                            <div className="mt-2.5 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeThreadLine != null) {
                                    commentDraftByLineRef.current[activeThreadLine] = activeThreadDraft;
                                  }
                                  setActiveThreadLine(null);
                                  setActiveThreadDraft('');
                                  setActiveThreadTop(null);
                                  clearThreadZone();
                                }}
                                className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={postingComment}
                                onClick={() => {
                                  void addCommentAtActiveLine();
                                }}
                                className="rounded-full border border-blue-700 bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {postingComment ? 'Posting...' : 'Comment'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-4 border-t border-slate-200 pt-4 text-sm italic text-slate-500">
                            You do not have permission to comment on this submission.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
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
