import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { EditorProps } from '@monaco-editor/react';
import type { IDisposable, editor as MonacoEditorNS } from 'monaco-editor';

import Header from '@/components/submissions/Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import {
  createOrReplaceReview,
  getReviews,
  getSubmission,
  getSubmissionFileContent,
} from '@/services/assignments/assignments.api';
import {
  getPlagiarismReport,
  triggerPlagiarismCheck,
} from '@/services/plagiarism/plagiarism.api';
import type {
  AssignmentSubmission,
  AssignmentSubmissionFile,
  ReviewCreatePayload,
  SubmissionReview,
} from '@/services/assignments/assignments.types';
import type {
  PlagiarismReport,
  SimilarityMatch,
} from '@/services/plagiarism/plagiarism.types';

const MonacoEditor = dynamic<EditorProps>(
  () => import('@monaco-editor/react').then((module) => module.default),
  { ssr: false }
);

const COMMENT_BUTTON_SIZE_PX = 28;

type ViewState = 'idle' | 'loading' | 'ready' | 'error';

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
  file: AssignmentSubmissionFile;
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

type DraftLineComment = {
  key: string;
  file_id: number;
  line_number: number;
  content: string;
};

type InlineCommentDraft = {
  lineNumber: number;
  fileId: number;
  content: string;
  top: number;
};

type ToastState = {
  type: 'success' | 'error';
  message: string;
} | null;

type PlagiarismPanelState = 'loading' | 'ready' | 'not-run' | 'error';

type SubmissionPair = {
  id: number;
  language: string;
  similarityForSubmission: number;
  maxSimilarity: number;
  linesMatched: number;
  counterpartName: string;
  counterpartEmail: string;
  isAiFlag: boolean;
  mossLink: string;
};

const normalizePath = (path: string): string => {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized || path;
};

const getDisplayPath = (file: AssignmentSubmissionFile): string => {
  if (file.file_path) return normalizePath(file.file_path);
  return file.file_name;
};

const formatSubmittedAt = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const formatFileSize = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) return '-';
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const normalizeIdentity = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase();

const getAiConfidenceLabel = (
  score: number | null
): 'High' | 'Medium' | 'Low' | 'None' => {
  if (score == null || !Number.isFinite(score)) return 'None';
  if (score >= 70) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
};

const toneForSimilarity = (value: number): string => {
  if (value >= 70) return 'text-rose-700 bg-rose-50 border-rose-200';
  if (value >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-emerald-700 bg-emerald-50 border-emerald-200';
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

const buildFileTree = (files: AssignmentSubmissionFile[]): TreeNode[] => {
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

const flattenFiles = (nodes: TreeNode[]): TreeFileNode[] => {
  const out: TreeFileNode[] = [];

  const visit = (items: TreeNode[]) => {
    items.forEach((item) => {
      if (item.kind === 'file') {
        out.push(item);
      } else {
        visit(item.children);
      }
    });
  };

  visit(nodes);
  return out;
};

const collectAllDirs = (nodes: TreeNode[]): Set<string> => {
  const out = new Set<string>();
  const visit = (items: TreeNode[]) => {
    items.forEach((item) => {
      if (item.kind === 'dir') {
        out.add(item.fullPath);
        visit(item.children);
      }
    });
  };
  visit(nodes);
  return out;
};

const splitReviews = (
  reviews: SubmissionReview[],
  firstName: string,
  lastName: string
): { myReview: SubmissionReview | null; otherReviews: SubmissionReview[] } => {
  const fullName = `${firstName} ${lastName}`.trim().toLowerCase();

  const mine =
    reviews.find(
      (review) => review.professor_name.trim().toLowerCase() === fullName
    ) ?? null;

  const others = mine ? reviews.filter((review) => review.id !== mine.id) : reviews;

  return {
    myReview: mine,
    otherReviews: others,
  };
};

const initialExpandedDirs = (nodes: TreeNode[]): Set<string> => {
  const out = new Set<string>();
  nodes.forEach((item) => {
    if (item.kind === 'dir') out.add(item.fullPath);
  });
  return out;
};

const LoadingShell = () => (
  <div className="min-h-screen bg-linear-to-b from-slate-100 via-slate-50 to-white">
    <Header activePage="Assignments" />
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white/90" />
      <div className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="h-[70vh] animate-pulse rounded-2xl border border-slate-200 bg-white/90" />
        <div className="h-[70vh] animate-pulse rounded-2xl border border-slate-200 bg-white/90" />
      </div>
      <div className="mt-5 h-72 animate-pulse rounded-2xl border border-slate-200 bg-white/90" />
    </main>
  </div>
);

type FileTreeProps = {
  nodes: TreeNode[];
  selectedFileId: number | null;
  expandedPaths: Set<string>;
  onToggleDir: (path: string) => void;
  onSelectFile: (file: AssignmentSubmissionFile) => void;
};

const FileTree = memo(function FileTree({
  nodes,
  selectedFileId,
  expandedPaths,
  onToggleDir,
  onSelectFile,
}: FileTreeProps) {
  const renderNodes = (items: TreeNode[], depth = 0) => {
    return items.map((node) => {
      if (node.kind === 'dir') {
        const isExpanded = expandedPaths.has(node.fullPath);
        return (
          <div key={`dir:${node.fullPath}`}>
            <button
              type="button"
              onClick={() => onToggleDir(node.fullPath)}
              className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
              style={{ paddingLeft: 8 + depth * 14 }}
              aria-expanded={isExpanded}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center text-xs text-slate-400 group-hover:text-slate-700">
                {isExpanded ? '▾' : '▸'}
              </span>
              <span className="truncate">{node.name}</span>
            </button>

            {isExpanded ? <div>{renderNodes(node.children, depth + 1)}</div> : null}
          </div>
        );
      }

      const isSelected = node.file.id === selectedFileId;
      return (
        <button
          key={`file:${node.file.id}`}
          type="button"
          onClick={() => onSelectFile(node.file)}
          title={node.fullPath}
          style={{ paddingLeft: 8 + depth * 14 }}
          className={
            'w-full rounded-lg px-2 py-1.5 text-left text-sm transition-all duration-150 ' +
            (isSelected
              ? 'bg-blue-600/15 text-blue-900 ring-1 ring-inset ring-blue-500/40 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
          }
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

function AssignmentSubmissionReviewPageContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [viewState, setViewState] = useState<ViewState>('idle');
  const [pageError, setPageError] = useState<string | null>(null);

  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [myReview, setMyReview] = useState<SubmissionReview | null>(null);
  const [otherReviews, setOtherReviews] = useState<SubmissionReview[]>([]);

  const [generalComment, setGeneralComment] = useState('');
  const [gradeInput, setGradeInput] = useState('');
  const [pendingComments, setPendingComments] = useState<DraftLineComment[]>([]);
  const [saving, setSaving] = useState(false);

  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [editorLanguage, setEditorLanguage] = useState('plaintext');
  const [editorValue, setEditorValue] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const [fileSearch, setFileSearch] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set<string>());

  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [hoverButtonTop, setHoverButtonTop] = useState(0);
  const [inlineComment, setInlineComment] = useState<InlineCommentDraft | null>(null);
  const [expandedOtherIds, setExpandedOtherIds] = useState<Set<number>>(new Set<number>());
  const [removingCommentKeys, setRemovingCommentKeys] = useState<Set<string>>(new Set<string>());
  const [lineSelectorValue, setLineSelectorValue] = useState('1');

  const [toast, setToast] = useState<ToastState>(null);
  const [plagiarismOpen, setPlagiarismOpen] = useState(true);
  const [plagiarismState, setPlagiarismState] =
    useState<PlagiarismPanelState>('loading');
  const [plagiarismReport, setPlagiarismReport] = useState<PlagiarismReport | null>(null);
  const [plagiarismError, setPlagiarismError] = useState<string | null>(null);
  const [runningPlagiarismCheck, setRunningPlagiarismCheck] = useState(false);

  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const editorDisposablesRef = useRef<IDisposable[]>([]);
  const decorationIdsRef = useRef<string[]>([]);
  const hoverHideTimerRef = useRef<number | null>(null);
  const hoverButtonInteractingRef = useRef(false);

  const hoveredLineRef = useRef<number | null>(null);
  const inlineDraftRef = useRef<InlineCommentDraft | null>(null);
  const fileCacheRef = useRef<Map<number, string>>(new Map());

  const clearHoverHideTimer = useCallback(() => {
    if (hoverHideTimerRef.current == null || typeof window === 'undefined') return;
    window.clearTimeout(hoverHideTimerRef.current);
    hoverHideTimerRef.current = null;
  }, []);

  const scheduleHoverHide = useCallback(() => {
    if (typeof window === 'undefined') return;

    clearHoverHideTimer();
    hoverHideTimerRef.current = window.setTimeout(() => {
      if (!hoverButtonInteractingRef.current && !inlineDraftRef.current) {
        setHoveredLine(null);
      }
      hoverHideTimerRef.current = null;
    }, 180);
  }, [clearHoverHideTimer]);

  useEffect(() => {
    hoveredLineRef.current = hoveredLine;
  }, [hoveredLine]);

  useEffect(() => {
    inlineDraftRef.current = inlineComment;
  }, [inlineComment]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  const assignmentId = useMemo(() => {
    const raw = router.query.id;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [router.query.id]);

  const submissionId = useMemo(() => {
    const raw = router.query.submissionId;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [router.query.submissionId]);

  const visibleFiles = useMemo(() => {
    const files = submission?.files ?? [];
    const query = fileSearch.trim().toLowerCase();

    if (!query) return files;

    return files.filter((file) =>
      getDisplayPath(file).toLowerCase().includes(query)
    );
  }, [fileSearch, submission?.files]);

  const fileTree = useMemo(() => buildFileTree(visibleFiles), [visibleFiles]);
  const fileIdToPath = useMemo(() => {
    const map = new Map<number, string>();
    (submission?.files ?? []).forEach((file) => {
      map.set(file.id, getDisplayPath(file));
    });
    return map;
  }, [submission?.files]);

  const flatVisibleFiles = useMemo(() => flattenFiles(fileTree), [fileTree]);

  const effectiveExpandedPaths = useMemo(() => {
    if (!fileSearch.trim()) return expandedPaths;
    return collectAllDirs(fileTree);
  }, [expandedPaths, fileSearch, fileTree]);

  const selectedFileMeta = useMemo(
    () => (submission?.files ?? []).find((file) => file.id === selectedFileId) ?? null,
    [selectedFileId, submission?.files]
  );

  const currentFileLineCount = useMemo(() => {
    if (!selectedFileId) return 0;

    const modelLineCount = editorRef.current?.getModel()?.getLineCount();
    if (modelLineCount && modelLineCount > 0) return modelLineCount;

    if (!editorValue) return 1;
    return Math.max(1, editorValue.split(/\r?\n/).length);
  }, [editorValue, selectedFileId]);

  const commentLinesForSelectedFile = useMemo(() => {
    if (!selectedFileId) return [];

    const unique = new Set<number>();
    pendingComments.forEach((comment) => {
      if (comment.file_id !== selectedFileId) return;
      if (comment.line_number <= 0 || !Number.isFinite(comment.line_number)) return;
      unique.add(comment.line_number);
    });

    return Array.from(unique).sort((a, b) => a - b);
  }, [pendingComments, selectedFileId]);

  const computeInlineCommentTop = useCallback((lineNumber: number): number => {
    const editor = editorRef.current;
    if (!editor || !Number.isFinite(lineNumber) || lineNumber <= 0) return 8;
    return Math.max(8, editor.getTopForLineNumber(lineNumber) - editor.getScrollTop() + 8);
  }, []);

  const computeHoverButtonTop = useCallback((lineNumber: number): number => {
    const editor = editorRef.current;
    if (!editor || !Number.isFinite(lineNumber) || lineNumber <= 0) return 4;

    const lineTop = editor.getTopForLineNumber(lineNumber) - editor.getScrollTop();
    const nextLineTop = editor.getTopForLineNumber(lineNumber + 1) - editor.getScrollTop();
    const lineHeight = nextLineTop > lineTop ? nextLineTop - lineTop : 20;

    return Math.max(
      4,
      lineTop + lineHeight / 2 - COMMENT_BUTTON_SIZE_PX / 2
    );
  }, []);

  const refreshLineDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco) return;

    const decorations = commentLinesForSelectedFile.map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: 'assignment-review-line-highlight',
        linesDecorationsClassName: 'assignment-review-line-gutter',
      },
    }));

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      decorations
    );
  }, [commentLinesForSelectedFile]);

  const fullPlagiarismReportHref = useMemo(() => {
    if (!assignmentId) return '#';
    return `/assignments/${assignmentId}/plagiarism`;
  }, [assignmentId]);

  const submissionPairs = useMemo(() => {
    if (!plagiarismReport) return [] as SubmissionPair[];

    const targetEmail = normalizeIdentity(submission?.student_email);
    const targetName = normalizeIdentity(submission?.student_name);

    const pairs: SubmissionPair[] = [];

    (plagiarismReport.matches ?? []).forEach((match: SimilarityMatch) => {
      const aEmail = normalizeIdentity(match.student_a_email);
      const bEmail = normalizeIdentity(match.student_b_email);
      const aName = normalizeIdentity(match.student_a_name);
      const bName = normalizeIdentity(match.student_b_name);

      const isA =
        (targetEmail.length > 0 && aEmail === targetEmail) ||
        (targetName.length > 0 && aName === targetName);
      const isB =
        (targetEmail.length > 0 && bEmail === targetEmail) ||
        (targetName.length > 0 && bName === targetName);

      if (!isA && !isB) return;

      const similarityForSubmission = isA
        ? Number(match.similarity_a ?? 0)
        : Number(match.similarity_b ?? 0);

      pairs.push({
        id: match.id,
        language: match.language || 'Unknown',
        similarityForSubmission,
        maxSimilarity: Number(match.max_similarity ?? similarityForSubmission),
        linesMatched: Number(match.lines_matched ?? 0),
        counterpartName: isA ? match.student_b_name || 'Unknown User' : match.student_a_name || 'Unknown User',
        counterpartEmail: isA ? match.student_b_email || '' : match.student_a_email || '',
        isAiFlag: Boolean(match.ai_moss_flag),
        mossLink: match.moss_link || '',
      });
    });

    return pairs.sort((a, b) => b.similarityForSubmission - a.similarityForSubmission);
  }, [plagiarismReport, submission?.student_email, submission?.student_name]);

  const highestPair = submissionPairs.length > 0 ? submissionPairs[0] : null;

  const aiSummary = useMemo(() => {
    const aiPairs = submissionPairs.filter((pair) => pair.isAiFlag);
    if (aiPairs.length === 0) {
      return {
        flagged: false,
        confidence: 'None' as const,
        score: null as number | null,
      };
    }

    const highestAi = aiPairs.reduce((max, pair) =>
      pair.similarityForSubmission > max ? pair.similarityForSubmission : max,
    0);

    return {
      flagged: true,
      confidence: getAiConfidenceLabel(highestAi),
      score: highestAi,
    };
  }, [submissionPairs]);

  useEffect(() => {
    refreshLineDecorations();
  }, [refreshLineDecorations]);

  useEffect(() => {
    if (!selectedFileId) {
      setLineSelectorValue('1');
      return;
    }

    setLineSelectorValue((prev) => {
      const parsed = Number(prev);
      if (!Number.isInteger(parsed) || parsed < 1) return '1';
      return String(Math.min(parsed, Math.max(1, currentFileLineCount)));
    });
  }, [currentFileLineCount, selectedFileId]);

  const openInlineComment = useCallback(
    (lineNumber: number) => {
      if (!selectedFileId || lineNumber <= 0) return;

      const editor = editorRef.current;
      const modelLineCount = editor?.getModel()?.getLineCount();
      const maxLine = Math.max(1, modelLineCount ?? currentFileLineCount ?? 1);
      const safeLine = Math.min(Math.max(1, Math.floor(lineNumber)), maxLine);

      editor?.setPosition({ lineNumber: safeLine, column: 1 });
      editor?.revealLineInCenter(safeLine);

      setLineSelectorValue(String(safeLine));
      setHoveredLine(safeLine);
      setHoverButtonTop(computeHoverButtonTop(safeLine));

      setInlineComment({
        lineNumber: safeLine,
        fileId: selectedFileId,
        content: '',
        top: computeInlineCommentTop(safeLine),
      });
    },
    [computeHoverButtonTop, computeInlineCommentTop, currentFileLineCount, selectedFileId]
  );

  const handleOpenSelectorComment = useCallback(() => {
    if (!selectedFileId) return;

    const requestedLine = Number(lineSelectorValue);
    const modelLineCount = editorRef.current?.getModel()?.getLineCount();
    const maxLine = Math.max(1, modelLineCount ?? currentFileLineCount ?? 1);

    if (!Number.isInteger(requestedLine) || requestedLine < 1 || requestedLine > maxLine) {
      setToast({
        type: 'error',
        message: `Select a line between 1 and ${maxLine}.`,
      });
      return;
    }

    openInlineComment(requestedLine);
  }, [currentFileLineCount, lineSelectorValue, openInlineComment, selectedFileId]);

  const removePendingComment = useCallback((key: string) => {
    setRemovingCommentKeys((prev) => new Set(prev).add(key));

    setTimeout(() => {
      setPendingComments((prev) => prev.filter((comment) => comment.key !== key));
      setRemovingCommentKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 220);
  }, []);

  const applyReviewIntoForm = useCallback((review: SubmissionReview | null) => {
    if (!review) {
      setGeneralComment('');
      setGradeInput('');
      setPendingComments([]);
      return;
    }

    setGeneralComment(review.general_comment ?? '');
    setGradeInput(review.grade == null ? '' : String(review.grade));
    setPendingComments(
      review.comments.map((comment) => ({
        key: `saved-${comment.id}`,
        file_id: comment.file,
        line_number: comment.line_number,
        content: comment.content,
      }))
    );
  }, []);

  const fetchReviewsAndHydrate = useCallback(async () => {
    if (!assignmentId || !submissionId || !user) return;

    const reviews = await getReviews(assignmentId, submissionId);
    const split = splitReviews(reviews, user.first_name, user.last_name);

    setMyReview(split.myReview);
    setOtherReviews(split.otherReviews);
    applyReviewIntoForm(split.myReview);
  }, [applyReviewIntoForm, assignmentId, submissionId, user]);

  const fetchPlagiarism = useCallback(async () => {
    if (!assignmentId) return;

    setPlagiarismError(null);
    setPlagiarismState('loading');

    try {
      const report = await getPlagiarismReport(assignmentId);
      setPlagiarismReport(report);
      setPlagiarismState('ready');
    } catch (error: unknown) {
      const maybeStatus =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { status?: number } }).response?.status === 'number'
          ? (error as { response?: { status?: number } }).response?.status
          : null;

      if (maybeStatus === 404) {
        setPlagiarismReport(null);
        setPlagiarismState('not-run');
        return;
      }

      setPlagiarismReport(null);
      setPlagiarismState('error');
      setPlagiarismError('Failed to load plagiarism data.');
    }
  }, [assignmentId]);

  const handleRunPlagiarismCheck = useCallback(async () => {
    if (!assignmentId || runningPlagiarismCheck) return;

    setRunningPlagiarismCheck(true);
    setPlagiarismError(null);

    try {
      await triggerPlagiarismCheck(assignmentId);
      await fetchPlagiarism();
      setToast({
        type: 'success',
        message: 'Plagiarism check started. Refreshing report data...',
      });
    } catch {
      setPlagiarismError('Unable to start plagiarism check right now.');
      setToast({
        type: 'error',
        message: 'Unable to start plagiarism check.',
      });
    } finally {
      setRunningPlagiarismCheck(false);
    }
  }, [assignmentId, fetchPlagiarism, runningPlagiarismCheck]);

  const openFile = useCallback(
    async (file: AssignmentSubmissionFile) => {
      if (!assignmentId || !submissionId) return;

      const displayPath = getDisplayPath(file);
      const cacheHit = fileCacheRef.current.get(file.id);

      setSelectedFileId(file.id);
      setSelectedFilePath(displayPath);
      setEditorLanguage(languageFromFilename(displayPath));
      setFileError(null);

      if (cacheHit != null) {
        setEditorValue(cacheHit);
        return;
      }

      setFileLoading(true);
      try {
        const content = await getSubmissionFileContent(assignmentId, submissionId, file.id);
        fileCacheRef.current.set(file.id, content);
        setEditorValue(content);
      } catch {
        setEditorValue('');
        setFileError('Unable to load this file.');
      } finally {
        setFileLoading(false);
      }
    },
    [assignmentId, submissionId]
  );

  useEffect(() => {
    if (!router.isReady) return;

    if (!assignmentId || !submissionId || !user) {
      if (assignmentId == null || submissionId == null) {
        setViewState('error');
        setPageError('Invalid assignment or submission id.');
      }
      return;
    }

    let cancelled = false;

    const load = async () => {
      setViewState('loading');
      setPageError(null);

      try {
        const [submissionData, reviews] = await Promise.all([
          getSubmission(assignmentId, submissionId),
          getReviews(assignmentId, submissionId),
        ]);

        if (cancelled) return;

        setSubmission(submissionData);
        fileCacheRef.current.clear();

        const split = splitReviews(reviews, user.first_name, user.last_name);
        setMyReview(split.myReview);
        setOtherReviews(split.otherReviews);
        applyReviewIntoForm(split.myReview);

        const tree = buildFileTree(submissionData.files ?? []);
        setExpandedPaths(initialExpandedDirs(tree));

        setViewState('ready');
      } catch {
        if (cancelled) return;
        setViewState('error');
        setPageError('Failed to load submission review data.');
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    applyReviewIntoForm,
    assignmentId,
    router.isReady,
    submissionId,
    user,
  ]);

  useEffect(() => {
    if (!assignmentId || !router.isReady) return;
    void fetchPlagiarism();
  }, [assignmentId, fetchPlagiarism, router.isReady]);

  useEffect(() => {
    if (!plagiarismReport) return;
    if (plagiarismReport.status !== 'pending' && plagiarismReport.status !== 'running') return;

    const interval = window.setInterval(() => {
      void fetchPlagiarism();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [fetchPlagiarism, plagiarismReport]);

  useEffect(() => {
    if (!submission) return;
    if ((submission.files?.length ?? 0) === 0) return;
    if (selectedFileId != null) return;

    const firstFile = submission.files![0];
    void openFile(firstFile);
  }, [openFile, selectedFileId, submission]);

  useEffect(() => {
    if (!inlineComment) return;
    setInlineComment((prev) =>
      prev
        ? {
            ...prev,
            top: computeInlineCommentTop(prev.lineNumber),
          }
        : prev
    );
  }, [computeInlineCommentTop, inlineComment, selectedFileId]);

  useEffect(() => {
    return () => {
      clearHoverHideTimer();
      editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
      editorDisposablesRef.current = [];
    };
  }, [clearHoverHideTimer]);

  const handleEditorMount: EditorProps['onMount'] = useCallback(
    (
      editor: MonacoEditorNS.IStandaloneCodeEditor,
      monaco: typeof import('monaco-editor')
    ) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
      editorDisposablesRef.current = [];

      const onMouseMove = editor.onMouseMove((event: MonacoEditorNS.IEditorMouseEvent) => {
        const lineNumber = event.target.position?.lineNumber;
        const targetType = event.target.type;

        const allowedTarget =
          targetType === monaco.editor.MouseTargetType.CONTENT_TEXT ||
          targetType === monaco.editor.MouseTargetType.CONTENT_EMPTY ||
          targetType === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;

        if (!selectedFileId) {
          setHoveredLine(null);
          return;
        }

        if (!allowedTarget || !lineNumber) {
          scheduleHoverHide();
          return;
        }

        clearHoverHideTimer();

        setHoveredLine(lineNumber);
        setHoverButtonTop(computeHoverButtonTop(lineNumber));
      });

      const onMouseLeave = editor.onMouseLeave(() => {
        scheduleHoverHide();
      });

      const onMouseDown = editor.onMouseDown((event: MonacoEditorNS.IEditorMouseEvent) => {
        clearHoverHideTimer();
        const targetType = event.target.type;
        const lineNumber = event.target.position?.lineNumber;

        if (
          targetType === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS &&
          lineNumber &&
          selectedFileId
        ) {
          openInlineComment(lineNumber);
        }
      });

      const onCursorChange = editor.onDidChangeCursorPosition(
        (event: MonacoEditorNS.ICursorPositionChangedEvent) => {
        if (!event.position?.lineNumber || !selectedFileId) return;
        clearHoverHideTimer();
        setHoveredLine(event.position.lineNumber);
        setHoverButtonTop(computeHoverButtonTop(event.position.lineNumber));
        }
      );

      const onScroll = editor.onDidScrollChange(() => {
        if (hoveredLineRef.current) {
          setHoverButtonTop(computeHoverButtonTop(hoveredLineRef.current));
        }

        if (inlineDraftRef.current) {
          setInlineComment((prev) =>
            prev
              ? {
                  ...prev,
                  top: computeInlineCommentTop(prev.lineNumber),
                }
              : prev
          );
        }
      });

      editorDisposablesRef.current.push(
        onMouseMove,
        onMouseLeave,
        onMouseDown,
        onCursorChange,
        onScroll
      );

      refreshLineDecorations();
    },
    [
      clearHoverHideTimer,
        computeHoverButtonTop,
        computeInlineCommentTop,
      openInlineComment,
      refreshLineDecorations,
      scheduleHoverHide,
      selectedFileId,
    ]
  );

  const handleToggleDir = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSaveReview = useCallback(async () => {
    if (!assignmentId || !submissionId) return;

    const trimmedGrade = gradeInput.trim();
    let grade: number | null = null;

    if (trimmedGrade !== '') {
      const numeric = Number(trimmedGrade);
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 20) {
        setToast({
          type: 'error',
          message: 'Grade must be a number between 0 and 20.',
        });
        return;
      }
      grade = numeric;
    }

    const payload: ReviewCreatePayload = {
      general_comment: generalComment.trim(),
      grade,
      comments: pendingComments.map((comment) => ({
        file_id: comment.file_id,
        line_number: comment.line_number,
        content: comment.content,
      })),
    };

    setSaving(true);
    try {
      await createOrReplaceReview(assignmentId, submissionId, payload);
      await fetchReviewsAndHydrate();

      setToast({
        type: 'success',
        message: myReview
          ? 'Review updated successfully.'
          : 'Review saved successfully.',
      });
    } catch {
      setToast({
        type: 'error',
        message: 'Unable to save review. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  }, [
    assignmentId,
    fetchReviewsAndHydrate,
    generalComment,
    gradeInput,
    myReview,
    pendingComments,
    submissionId,
  ]);

  const handleAddPendingComment = useCallback(() => {
    if (!inlineComment) return;

    const content = inlineComment.content.trim();
    if (!content) {
      setToast({
        type: 'error',
        message: 'Line comment cannot be empty.',
      });
      return;
    }

    setPendingComments((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file_id: inlineComment.fileId,
        line_number: inlineComment.lineNumber,
        content,
      },
    ]);

    setInlineComment(null);
  }, [inlineComment]);

  const toggleOtherReview = useCallback((reviewId: number) => {
    setExpandedOtherIds((prev) => {
      const next = new Set(prev);
      if (next.has(reviewId)) {
        next.delete(reviewId);
      } else {
        next.add(reviewId);
      }
      return next;
    });
  }, []);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    void router.push('/assignments');
  }, [router]);

  if (viewState === 'idle' || viewState === 'loading') {
    return <LoadingShell />;
  }

  if (viewState === 'error' || !submission) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-100 via-slate-50 to-white">
        <Header activePage="Assignments" />
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-50"
            >
              <span aria-hidden="true">←</span>
              Back
            </button>

            <h1 className="mt-6 text-2xl font-bold text-slate-900">Unable to load review page</h1>
            <p className="mt-2 text-sm text-slate-600">{pageError ?? 'Unknown error.'}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Review Submission - ESICodeHub</title>
      </Head>

      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .assignment-review-line-highlight {
          background: linear-gradient(
            90deg,
            rgba(250, 204, 21, 0.28),
            rgba(250, 204, 21, 0.14)
          );
          border-left: 2px solid rgba(234, 179, 8, 0.95);
        }

        .assignment-review-line-gutter {
          border-left: 2px solid rgba(245, 158, 11, 0.85);
          margin-left: 4px;
        }
      `}</style>

      <div className="min-h-screen bg-linear-to-b from-slate-100 via-slate-50 to-white text-slate-900">
        <Header activePage="Assignments" />

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleBack}
                className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow active:scale-95"
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
                Back
              </button>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{submission.student_name}</span>
                <span className="text-slate-300">•</span>
                <span>Submitted {formatSubmittedAt(submission.submitted_at)}</span>
                <span className="text-slate-300">•</span>
                <span
                  className={
                    'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ' +
                    (submission.is_late
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700')
                  }
                >
                  {submission.is_late ? 'Late submission' : 'On time'}
                </span>
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="h-[56vh] min-h-95 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[74vh]">
              <div className="border-b border-slate-200 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  File Tree
                </h2>
                <div className="mt-3">
                  <input
                    value={fileSearch}
                    onChange={(event) => setFileSearch(event.target.value)}
                    placeholder="Search files..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-200/60"
                  />
                </div>
              </div>

              <div className="h-[calc(56vh-88px)] overflow-y-auto px-2 py-2 lg:h-[calc(74vh-88px)]">
                {flatVisibleFiles.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    {fileSearch.trim()
                      ? 'No matching files for this search.'
                      : 'No files attached to this submission.'}
                  </div>
                ) : (
                  <FileTree
                    nodes={fileTree}
                    selectedFileId={selectedFileId}
                    expandedPaths={effectiveExpandedPaths}
                    onToggleDir={handleToggleDir}
                    onSelectFile={openFile}
                  />
                )}
              </div>
            </aside>

            <div
              className={
                'grid gap-4 ' +
                (plagiarismOpen
                  ? 'xl:grid-cols-[minmax(0,1fr)_340px]'
                  : 'xl:grid-cols-1')
              }
            >
              <section className="h-[56vh] min-h-95 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm lg:h-[74vh]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {selectedFilePath || 'Select a file'}
                    </p>
                    {selectedFileMeta ? (
                      <p className="text-xs text-slate-400">{formatFileSize(selectedFileMeta.file_size)}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-400">
                      {commentLinesForSelectedFile.length} commented line
                      {commentLinesForSelectedFile.length === 1 ? '' : 's'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPlagiarismOpen((prev) => !prev)}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
                    >
                      {plagiarismOpen ? 'Hide plagiarism panel' : 'Show plagiarism panel'}
                    </button>
                  </div>
                </div>
                <div className="relative h-[calc(56vh-57px)] lg:h-[calc(74vh-57px)]">
                  {selectedFileId && hoveredLine && !inlineComment ? (
                    <button
                      type="button"
                      onClick={() => openInlineComment(hoveredLine)}
                      onMouseEnter={() => {
                        hoverButtonInteractingRef.current = true;
                        clearHoverHideTimer();
                      }}
                      onMouseLeave={() => {
                        hoverButtonInteractingRef.current = false;
                        scheduleHoverHide();
                      }}
                      style={{ top: hoverButtonTop }}
                      className="absolute right-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-yellow-300 bg-yellow-200/90 text-base font-bold text-yellow-900 shadow transition-all duration-200 hover:scale-105 hover:bg-yellow-100"
                      title={`Add line comment at line ${hoveredLine}`}
                    >
                      +
                    </button>
                  ) : null}

                  {inlineComment ? (
                  <div
                    style={{ top: inlineComment.top }}
                    className="absolute left-4 right-4 z-20 w-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg animate-[fadeUp_0.18s_ease] sm:left-auto sm:right-4 sm:w-[320px]"
                  >
                    <p className="text-xs font-semibold text-slate-700">
                      Add comment at line {inlineComment.lineNumber}
                    </p>
                    <textarea
                      value={inlineComment.content}
                      onChange={(event) =>
                        setInlineComment((prev) =>
                          prev
                            ? {
                                ...prev,
                                content: event.target.value,
                              }
                            : prev
                        )
                      }
                      placeholder="Write your line-level feedback..."
                      rows={3}
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-200/70"
                    />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setInlineComment(null)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddPendingComment}
                        className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  ) : null}

                  {fileLoading ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/65">
                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-slate-100" />
                      Loading file...
                    </div>
                  </div>
                  ) : null}

                  {selectedFileId == null ? (
                  <div className="flex h-full items-center justify-center px-4 text-center">
                    <div>
                      <p className="text-base font-semibold text-slate-100">No file selected</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Pick a file from the tree to start reviewing code.
                      </p>
                    </div>
                  </div>
                  ) : (
                  <MonacoEditor
                    height="100%"
                    theme="vs-dark"
                    language={editorLanguage}
                    value={editorValue}
                    onMount={handleEditorMount}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      fontSize: 13,
                      lineNumbersMinChars: 3,
                      renderLineHighlight: 'all',
                      automaticLayout: true,
                      glyphMargin: true,
                      lineDecorationsWidth: 16,
                    }}
                  />
                  )}
                </div>

                {fileError ? (
                  <div className="border-t border-rose-700/30 bg-rose-900/15 px-4 py-2 text-xs text-rose-200">
                    {fileError}
                  </div>
                ) : null}
              </section>

              {plagiarismOpen ? (
                <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">
                        Plagiarism Snapshot
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        For {submission.student_email || submission.student_name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPlagiarismOpen(false)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Collapse
                    </button>
                  </div>

                  {plagiarismState === 'loading' ? (
                    <p className="mt-4 text-sm text-slate-500">Loading plagiarism data...</p>
                  ) : null}

                  {plagiarismState === 'error' ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                      <p className="text-sm font-medium text-rose-700">
                        {plagiarismError || 'Failed to load plagiarism data.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => void fetchPlagiarism()}
                        className="mt-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}

                  {plagiarismState === 'not-run' ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-800">Plagiarism check not run yet</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Run a plagiarism check to see MOSS and AI indicators for this submission.
                      </p>
                      <button
                        type="button"
                        onClick={handleRunPlagiarismCheck}
                        disabled={runningPlagiarismCheck}
                        className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {runningPlagiarismCheck ? 'Starting...' : 'Run plagiarism check'}
                      </button>
                    </div>
                  ) : null}

                  {plagiarismState === 'ready' && plagiarismReport ? (
                    <>
                      {(plagiarismReport.status === 'pending' || plagiarismReport.status === 'running') ? (
                        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
                          <p className="text-sm font-semibold text-blue-800">
                            Plagiarism check is {plagiarismReport.status}
                          </p>
                          <p className="mt-1 text-xs text-blue-700">
                            This panel auto-refreshes while analysis is running.
                          </p>
                        </div>
                      ) : null}

                      {plagiarismReport.status === 'complete' ? (
                        <>
                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                              Highest MOSS Match
                            </p>
                            {highestPair ? (
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {Math.round(highestPair.similarityForSubmission)}% match with{' '}
                                {highestPair.counterpartEmail || highestPair.counterpartName}
                              </p>
                            ) : (
                              <p className="mt-1 text-sm text-slate-600">No similarity pairs for this submission.</p>
                            )}
                          </div>

                          <div
                            className={
                              'mt-3 rounded-xl border p-3 ' +
                              (aiSummary.flagged
                                ? 'border-rose-200 bg-rose-50'
                                : 'border-emerald-200 bg-emerald-50')
                            }
                          >
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                              AI Usage Flag
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {aiSummary.flagged ? 'Flagged as AI-like' : 'Not flagged as AI-like'}
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              Confidence: {aiSummary.confidence}
                              {aiSummary.score != null ? ` (${Math.round(aiSummary.score)}%)` : ''}
                            </p>
                          </div>

                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                              Pairs Involving This Submission
                            </p>

                            {submissionPairs.length === 0 ? (
                              <p className="mt-2 text-sm text-slate-500">No pairs found for this submission.</p>
                            ) : (
                              <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                                {submissionPairs.map((pair) => (
                                  <div
                                    key={pair.id}
                                    className="rounded-lg border border-slate-200 bg-white p-2.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span
                                        className={
                                          'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ' +
                                          toneForSimilarity(pair.similarityForSubmission)
                                        }
                                      >
                                        {Math.round(pair.similarityForSubmission)}%
                                      </span>
                                      <span className="text-[11px] text-slate-500">{pair.language}</span>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-700">
                                      Match with {pair.counterpartEmail || pair.counterpartName}
                                    </p>
                                    <p className="mt-1 text-[11px] text-slate-500">
                                      {pair.linesMatched} matched lines
                                      {pair.isAiFlag ? ' • AI reference involved' : ''}
                                    </p>
                                    {pair.mossLink ? (
                                      <a
                                        href={pair.mossLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-1 inline-flex text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                                      >
                                        View MOSS diff
                                      </a>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      ) : null}

                      {plagiarismReport.status === 'failed' ? (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                          <p className="text-sm font-semibold text-rose-700">Plagiarism check failed</p>
                          <p className="mt-1 text-xs text-rose-600">
                            {plagiarismReport.error_message || 'The report could not be generated.'}
                          </p>
                          <button
                            type="button"
                            onClick={handleRunPlagiarismCheck}
                            disabled={runningPlagiarismCheck}
                            className="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {runningPlagiarismCheck ? 'Starting...' : 'Retry check'}
                          </button>
                        </div>
                      ) : null}

                      <div className="mt-4 border-t border-slate-200 pt-3">
                        <Link
                          href={fullPlagiarismReportHref}
                          className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                        >
                          Open full plagiarism report →
                        </Link>
                      </div>
                    </>
                  ) : null}
                </aside>
              ) : null}
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">My Review</h3>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {myReview ? 'Updating existing review' : 'New review'}
              </span>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">General comment</span>
                <textarea
                  value={generalComment}
                  onChange={(event) => setGeneralComment(event.target.value)}
                  placeholder="Summarize strengths, issues, and next steps for this student."
                  rows={5}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-200/70"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Grade</span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={gradeInput}
                    onChange={(event) => setGradeInput(event.target.value)}
                    type="number"
                    min={0}
                    max={20}
                    step={0.25}
                    placeholder="0 - 20"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all duration-200 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-200/70"
                  />
                  <span className="text-sm font-semibold text-slate-500">/ 20</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Leave empty if you want to submit feedback without a grade.
                </p>
              </label>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-800">Pending line comments</h4>
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="line-selector"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <span>Line</span>
                    <input
                      id="line-selector"
                      type="number"
                      min={1}
                      max={Math.max(1, currentFileLineCount)}
                      step={1}
                      value={lineSelectorValue}
                      onChange={(event) => setLineSelectorValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleOpenSelectorComment();
                        }
                      }}
                      disabled={!selectedFileId}
                      className="w-20 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-200/70 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span className="text-[11px] text-slate-500">/ {Math.max(1, currentFileLineCount)}</span>
                  </label>

                  <button
                    type="button"
                    disabled={!selectedFileId}
                    onClick={handleOpenSelectorComment}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-all duration-200 hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-sm leading-none">+</span>
                    Add line comment
                  </button>
                </div>
              </div>

              {pendingComments.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No line comments yet. Use the line selector or click a line number in the editor.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {pendingComments.map((comment) => {
                    const filePath = fileIdToPath.get(comment.file_id) ?? `File #${comment.file_id}`;
                    const removing = removingCommentKeys.has(comment.key);

                    return (
                      <div
                        key={comment.key}
                        className={
                          'flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 transition-all duration-200 ' +
                          (removing
                            ? 'translate-y-1 opacity-0'
                            : 'translate-y-0 opacity-100')
                        }
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-500">
                            File: {filePath}  Line: {comment.line_number}
                          </p>
                          <p className="mt-1 text-sm text-slate-700">{comment.content}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePendingComment(comment.key)}
                          className="rounded-md px-2 py-1 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50"
                          aria-label="Remove line comment"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveReview}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving review...' : 'Save Review'}
              </button>
              <p className="text-xs text-slate-500">
                Saving will replace your previous review entirely.
              </p>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Other Reviews</h3>

            {otherReviews.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No reviews from other professors yet.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {otherReviews.map((review) => {
                  const isExpanded = expandedOtherIds.has(review.id);

                  return (
                    <article
                      key={review.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {review.professor_name}
                        </p>
                        <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                          Grade: {review.grade == null ? '-' : review.grade}/20
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-700">
                        {review.general_comment || 'No general comment.'}
                      </p>

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => toggleOtherReview(review.id)}
                          className="text-xs font-semibold text-blue-700 transition-colors hover:text-blue-900"
                        >
                          {isExpanded
                            ? `Hide line comments (${review.comments.length})`
                            : `Show line comments (${review.comments.length})`}
                        </button>

                        {isExpanded ? (
                          <div className="mt-2 space-y-2">
                            {review.comments.length === 0 ? (
                              <p className="text-xs text-slate-500">No line comments.</p>
                            ) : (
                              review.comments.map((comment) => (
                                <div
                                  key={comment.id}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                                >
                                  <p className="text-xs font-semibold text-slate-500">
                                    {fileIdToPath.get(comment.file) ?? `File #${comment.file}`}  Line:{' '}
                                    {comment.line_number}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-700">{comment.content}</p>
                                </div>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        {toast ? (
          <div className="pointer-events-none fixed right-4 top-20 z-50">
            <div
              className={
                'rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg animate-[fadeUp_0.2s_ease] ' +
                (toast.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700')
              }
            >
              {toast.message}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

export default function AssignmentSubmissionReviewPage() {
  return (
    <ProtectedRoute allowedRole="professor">
      <AssignmentSubmissionReviewPageContent />
    </ProtectedRoute>
  );
}
