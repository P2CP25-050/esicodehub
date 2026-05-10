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
  <div style={{ minHeight: '100vh', background: '#fff', position: 'relative' }}>
    <Header activePage="Assignments" />
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 28px 80px', position: 'relative', zIndex: 1 }}>
      <div style={{ height: 72, border: '1.5px solid #000', borderTop: '4px solid #051650', background: '#f7f7f5', animation: 'pulse 2s cubic-bezier(.4,0,.6,1) infinite' }} />
      <div style={{ marginTop: 20, display: 'grid', gap: 20, gridTemplateColumns: '300px 1fr' }}>
        <div style={{ height: '70vh', border: '1.5px solid #000', borderTop: '4px solid #051650', background: '#f7f7f5', animation: 'pulse 2s cubic-bezier(.4,0,.6,1) infinite' }} />
        <div style={{ height: '70vh', border: '1.5px solid #000', borderTop: '4px solid #051650', background: '#f7f7f5', animation: 'pulse 2s cubic-bezier(.4,0,.6,1) infinite' }} />
      </div>
      <div style={{ marginTop: 20, height: 288, border: '1.5px solid #000', borderTop: '4px solid #051650', background: '#f7f7f5', animation: 'pulse 2s cubic-bezier(.4,0,.6,1) infinite' }} />
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
              className="group flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm font-medium transition-colors duration-150 hover:bg-[#f0efec]"
              style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#444', paddingLeft: 8 + depth * 14 }}
              aria-expanded={isExpanded}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center text-xs" style={{ color: '#999' }}>
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
          className={
            'w-full px-2 py-1.5 text-left text-sm transition-all duration-150 ' +
            (isSelected
              ? 'bg-[#051650]/10 font-bold'
              : 'hover:bg-[#f0efec]')
          }
          style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: isSelected ? '#051650' : '#444', paddingLeft: 8 + depth * 14 }}
        >
          <span className="inline-flex max-w-full items-center gap-2">
            <span style={{ color: '#aaa' }}>#</span>
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
  const [plagiarismOpen, setPlagiarismOpen] = useState(false);
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
      <div style={{ minHeight: '100vh', background: '#fff' }}>
        <Header activePage="Assignments" />
        <main style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 28px' }}>
          <div style={{ border: '1.5px solid #000', borderTop: '4px solid #cc0000', background: '#fff8f8', padding: 32 }}>
            <button
              type="button"
              onClick={handleBack}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1.5px solid #000', background: '#fff', padding: '7px 16px', fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' }}
            >
              ← Back
            </button>
            <h1 style={{ marginTop: 24, fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 900, color: '#000' }}>Unable to load review page</h1>
            <p style={{ marginTop: 8, fontSize: 14, color: '#666' }}>{pageError ?? 'Unknown error.'}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Review Submission — ESICodeHub</title>
      </Head>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes srRiseIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .assignment-review-line-highlight {
          background: linear-gradient(90deg, rgba(250, 204, 21, 0.28), rgba(250, 204, 21, 0.14));
          border-left: 2px solid rgba(234, 179, 8, 0.95);
        }
        .assignment-review-line-gutter {
          border-left: 2px solid rgba(245, 158, 11, 0.85);
          margin-left: 4px;
        }

        .sr-page {
          min-height: 100vh;
          background: #ffffff;
          font-family: 'DM Sans', system-ui, sans-serif;
          color: #000;
          position: relative;
        }
        .sr-page::before {
          content: '';
          position: fixed;
          top: 0; right: 0;
          width: 280px;
          height: 100vh;
          background: #051650;
          clip-path: polygon(80px 0, 100% 0, 100% 100%, 0 100%);
          z-index: 0;
          pointer-events: none;
        }
        .sr-page::after {
          content: '';
          position: fixed;
          top: 64px; left: 0; right: 0;
          height: 1.5px;
          background: #000;
          z-index: 0;
          pointer-events: none;
        }
        .sr-container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 40px 28px 80px;
          position: relative;
          z-index: 1;
        }
        .sr-card {
          background: #fff;
          border: 1.5px solid #000;
          border-top: 4px solid #051650;
          position: relative;
        }
        .sr-card::after {
          content: '';
          position: absolute;
          bottom: -2px; right: -2px;
          width: 20px; height: 20px;
          border-bottom: 4px solid #051650;
          border-right: 4px solid #051650;
          pointer-events: none;
        }
        .sr-aside {
          background: #fff;
          border: 1.5px solid #000;
          border-top: 4px solid #051650;
          position: relative;
          overflow: hidden;
        }
        .sr-editor-panel {
          background: #0d1117;
          border: 1.5px solid #000;
          border-top: 4px solid #051650;
          position: relative;
          overflow: hidden;
        }
        .sr-section-label {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #666;
          font-weight: 700;
        }
        .sr-mono { font-family: 'Space Mono', monospace; }
        .sr-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1.5px solid #000;
          background: #fff;
          padding: 7px 16px;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          transition: background 0.15s;
        }
        .sr-back-btn:hover { background: #f0efec; }
        .sr-input {
          border: 1.5px solid #000;
          background: #f7f7f5;
          padding: 8px 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #000;
          outline: none;
          width: 100%;
          transition: background 0.15s;
          border-radius: 0;
        }
        .sr-input:focus { background: #fff; border-color: #051650; }
        .sr-input::placeholder { color: #aaa; }
        .sr-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #051650;
          color: #fff;
          border: 1.5px solid #051650;
          padding: 9px 22px;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          transition: opacity 0.15s;
        }
        .sr-btn-primary:hover { opacity: 0.85; }
        .sr-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .sr-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1.5px solid #000;
          background: #fff;
          padding: 5px 12px;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: background 0.15s;
        }
        .sr-btn-ghost:hover { background: #f0efec; }
        .sr-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
        .sr-tag {
          display: inline-flex;
          align-items: center;
          border: 1.5px solid #000;
          padding: 2px 10px;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .sr-tag-late   { border-color: #cc0000; color: #cc0000; background: #fff8f8; }
        .sr-tag-ontime { border-color: #1a7a3c; color: #1a7a3c; background: #f2fdf6; }
        .sr-tag-blue   { border-color: #051650; color: #051650; background: #f0f3ff; }
        .sr-tag-warn   { border-color: #b85c00; color: #b85c00; background: #fff8f2; }
        .sr-animate { animation: srRiseIn 0.35s ease both; }
        @media (max-width: 900px) {
          .sr-page::before { display: none; }
          .sr-container { padding: 20px 16px 60px; }
        }
      `}</style>

      <div className="sr-page">
        <Header activePage="Assignments" />

        <main className="sr-container">
          {/* Info bar */}
          <section className="sr-card p-4 sm:p-5 sr-animate" style={{ animationDelay: '0ms' }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleBack}
                className="sr-back-btn"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M6.5 3.5 2 8m0 0 4.5 4.5M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <span className="sr-mono font-bold" style={{ fontSize: 13 }}>{submission.student_name}</span>
                <span style={{ color: '#ccc' }}>·</span>
                <span className="text-xs" style={{ color: '#666' }}>Submitted {formatSubmittedAt(submission.submitted_at)}</span>
                <span style={{ color: '#ccc' }}>·</span>
                <span className={'sr-tag ' + (submission.is_late ? 'sr-tag-late' : 'sr-tag-ontime')}>
                  {submission.is_late ? 'Late' : 'On time'}
                </span>
              </div>
            </div>
          </section>

          {/* File tree + editor grid */}
          <section className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] sr-animate" style={{ animationDelay: '60ms' }}>
            <aside className="sr-aside h-[56vh] min-h-[380px] lg:h-[74vh]">
              <div className="border-b border-black p-4">
                <p className="sr-section-label">File Tree</p>
                <div className="mt-3">
                  <input
                    value={fileSearch}
                    onChange={(event) => setFileSearch(event.target.value)}
                    placeholder="Search files..."
                    className="sr-input"
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>

              <div className="h-[calc(56vh-88px)] overflow-y-auto px-2 py-2 lg:h-[calc(74vh-88px)]">
                {flatVisibleFiles.length === 0 ? (
                  <div className="border border-dashed border-black/20 bg-[#f7f7f5] px-4 py-6 text-center text-sm" style={{ color: '#666' }}>
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

            {/* Editor + plagiarism column */}
            <div
              className={
                'grid gap-4 ' +
                (plagiarismOpen
                  ? 'xl:grid-cols-[minmax(0,1fr)_340px]'
                  : 'xl:grid-cols-1')
              }
            >
              {/* Code editor panel */}
              <section className="sr-editor-panel h-[56vh] min-h-[380px] lg:h-[74vh]">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <div className="min-w-0">
                    <p className="sr-mono truncate text-sm font-bold text-slate-100">
                      {selectedFilePath || 'Select a file'}
                    </p>
                    {selectedFileMeta ? (
                      <p className="text-xs text-slate-400">{formatFileSize(selectedFileMeta.file_size)}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="sr-section-label text-slate-400" style={{ textTransform: 'none' }}>
                      {commentLinesForSelectedFile.length} commented line
                      {commentLinesForSelectedFile.length === 1 ? '' : 's'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPlagiarismOpen((prev) => !prev)}
                      className="sr-btn-ghost"
                      style={{ background: '#1e293b', borderColor: '#475569', color: '#e2e8f0' }}
                    >
                      {plagiarismOpen ? 'Hide plagiarism' : 'Show plagiarism'}
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
                      className="absolute right-3 z-10 inline-flex h-7 w-7 items-center justify-center border border-yellow-300 bg-yellow-200/90 text-base font-bold text-yellow-900 shadow transition-all duration-200 hover:scale-105 hover:bg-yellow-100"
                      title={`Add line comment at line ${hoveredLine}`}
                    >
                      +
                    </button>
                  ) : null}

                  {inlineComment ? (
                  <div
                    style={{ top: inlineComment.top, background: '#fff', border: '1.5px solid #000', borderTop: '4px solid #051650', padding: 12, zIndex: 20 }}
                    className="absolute left-4 right-4 sm:left-auto sm:right-4 sm:w-[320px] animate-[fadeUp_0.18s_ease]"
                  >
                    <p className="sr-section-label">Add comment — line {inlineComment.lineNumber}</p>
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
                      className="sr-input mt-2 resize-none"
                      style={{ fontSize: 13 }}
                    />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setInlineComment(null)}
                        className="sr-btn-ghost"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddPendingComment}
                        className="sr-btn-primary"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  ) : null}

                  {fileLoading ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'rgba(13,17,23,0.72)' }}>
                    <div className="inline-flex items-center gap-2 px-3 py-2" style={{ border: '1.5px solid #475569', background: '#1e293b', color: '#e2e8f0', fontFamily: "'Space Mono', monospace", fontSize: 12 }}>
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
                <aside className="sr-card overflow-y-auto" style={{ padding: 16, maxHeight: '74vh' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="sr-section-label">Plagiarism Snapshot</p>
                      <p className="mt-1 text-xs" style={{ color: '#666' }}>
                        For {submission.student_email || submission.student_name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPlagiarismOpen(false)}
                      className="sr-btn-ghost"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                    >
                      Collapse
                    </button>
                  </div>

                  {plagiarismState === 'loading' ? (
                    <p className="mt-4 text-sm" style={{ color: '#666' }}>Loading plagiarism data...</p>
                  ) : null}

                  {plagiarismState === 'error' ? (
                    <div className="mt-4" style={{ border: '1.5px solid #cc0000', borderTop: '3px solid #cc0000', background: '#fff8f8', padding: 12 }}>
                      <p className="text-sm font-bold" style={{ color: '#cc0000' }}>
                        {plagiarismError || 'Failed to load plagiarism data.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => void fetchPlagiarism()}
                        className="sr-btn-ghost mt-2"
                        style={{ fontSize: 11, borderColor: '#cc0000', color: '#cc0000' }}
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}

                  {plagiarismState === 'not-run' ? (
                    <div className="mt-4" style={{ border: '1.5px solid #000', background: '#f7f7f5', padding: 12 }}>
                      <p className="text-sm font-bold">Plagiarism check not run yet</p>
                      <p className="mt-1 text-xs" style={{ color: '#666' }}>
                        Run a plagiarism check to see MOSS and AI indicators for this submission.
                      </p>
                      <button
                        type="button"
                        onClick={handleRunPlagiarismCheck}
                        disabled={runningPlagiarismCheck}
                        className="sr-btn-primary mt-3"
                        style={{ fontSize: 11, padding: '6px 14px' }}
                      >
                        {runningPlagiarismCheck ? 'Starting...' : 'Run plagiarism check'}
                      </button>
                    </div>
                  ) : null}

                  {plagiarismState === 'ready' && plagiarismReport ? (
                    <>
                      {(plagiarismReport.status === 'pending' || plagiarismReport.status === 'running') ? (
                        <div className="mt-4" style={{ border: '1.5px solid #051650', borderTop: '3px solid #051650', background: '#f0f3ff', padding: 12 }}>
                          <p className="text-sm font-bold" style={{ color: '#051650' }}>
                            Plagiarism check is {plagiarismReport.status}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: '#444' }}>
                            This panel auto-refreshes while analysis is running.
                          </p>
                        </div>
                      ) : null}

                      {plagiarismReport.status === 'complete' ? (
                        <>
                          <div className="mt-4" style={{ border: '1.5px solid #000', background: '#f7f7f5', padding: 12 }}>
                            <p className="sr-section-label">Highest MOSS Match</p>
                            {highestPair ? (
                              <p className="mt-1 text-sm font-bold">
                                {Math.round(highestPair.similarityForSubmission)}% match with{' '}
                                {highestPair.counterpartEmail || highestPair.counterpartName}
                              </p>
                            ) : (
                              <p className="mt-1 text-sm" style={{ color: '#666' }}>No similarity pairs for this submission.</p>
                            )}
                          </div>

                          <div
                            className="mt-3"
                            style={{
                              border: `1.5px solid ${aiSummary.flagged ? '#cc0000' : '#1a7a3c'}`,
                              borderTop: `3px solid ${aiSummary.flagged ? '#cc0000' : '#1a7a3c'}`,
                              background: aiSummary.flagged ? '#fff8f8' : '#f2fdf6',
                              padding: 12,
                            }}
                          >
                            <p className="sr-section-label">AI Usage Flag</p>
                            <p className="mt-1 text-sm font-bold">
                              {aiSummary.flagged ? 'Flagged as AI-like' : 'Not flagged as AI-like'}
                            </p>
                            <p className="mt-1 text-xs" style={{ color: '#444' }}>
                              Confidence: {aiSummary.confidence}
                              {aiSummary.score != null ? ` (${Math.round(aiSummary.score)}%)` : ''}
                            </p>
                          </div>

                          <div className="mt-3">
                            <p className="sr-section-label">Pairs Involving This Submission</p>

                            {submissionPairs.length === 0 ? (
                              <p className="mt-2 text-sm" style={{ color: '#666' }}>No pairs found for this submission.</p>
                            ) : (
                              <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                                {submissionPairs.map((pair) => (
                                  <div
                                    key={pair.id}
                                    style={{ border: '1.5px solid #000', background: '#f7f7f5', padding: 10 }}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span
                                        className={'sr-tag ' + toneForSimilarity(pair.similarityForSubmission)}
                                      >
                                        {Math.round(pair.similarityForSubmission)}%
                                      </span>
                                      <span className="sr-section-label">{pair.language}</span>
                                    </div>
                                    <p className="mt-1 text-xs" style={{ color: '#444' }}>
                                      Match with {pair.counterpartEmail || pair.counterpartName}
                                    </p>
                                    <p className="mt-1 text-xs" style={{ color: '#666' }}>
                                      {pair.linesMatched} matched lines
                                      {pair.isAiFlag ? ' · AI reference involved' : ''}
                                    </p>
                                    {pair.mossLink ? (
                                      <a
                                        href={pair.mossLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-1 inline-flex text-xs font-bold"
                                        style={{ color: '#051650', borderBottom: '1px solid #051650' }}
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
                        <div className="mt-4" style={{ border: '1.5px solid #cc0000', borderTop: '3px solid #cc0000', background: '#fff8f8', padding: 12 }}>
                          <p className="text-sm font-bold" style={{ color: '#cc0000' }}>Plagiarism check failed</p>
                          <p className="mt-1 text-xs" style={{ color: '#b00' }}>
                            {plagiarismReport.error_message || 'The report could not be generated.'}
                          </p>
                          <button
                            type="button"
                            onClick={handleRunPlagiarismCheck}
                            disabled={runningPlagiarismCheck}
                            className="sr-btn-ghost mt-3"
                            style={{ fontSize: 11, borderColor: '#cc0000', color: '#cc0000' }}
                          >
                            {runningPlagiarismCheck ? 'Starting...' : 'Retry check'}
                          </button>
                        </div>
                      ) : null}

                      <div className="mt-4" style={{ borderTop: '1.5px solid #000', paddingTop: 12 }}>
                        <Link
                          href={fullPlagiarismReportHref}
                          className="sr-mono text-xs font-bold"
                          style={{ color: '#051650', borderBottom: '1.5px solid #051650' }}
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

          <section className="sr-card mt-5 p-5 sr-animate" style={{ animationDelay: '120ms' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 900 }}>My Review</h3>
              <span className={'sr-tag ' + (myReview ? 'sr-tag-blue' : 'sr-tag-ontime')}>
                {myReview ? 'Updating existing review' : 'New review'}
              </span>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="block">
                <span className="sr-section-label">General comment</span>
                <textarea
                  value={generalComment}
                  onChange={(event) => setGeneralComment(event.target.value)}
                  placeholder="Summarize strengths, issues, and next steps for this student."
                  rows={5}
                  className="sr-input mt-2 resize-none"
                />
              </label>

              <label className="block">
                <span className="sr-section-label">Grade</span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={gradeInput}
                    onChange={(event) => setGradeInput(event.target.value)}
                    type="number"
                    min={0}
                    max={20}
                    step={0.25}
                    placeholder="0 – 20"
                    className="sr-input"
                    style={{ fontWeight: 700 }}
                  />
                  <span className="sr-mono text-sm font-bold">/ 20</span>
                </div>
                <p className="mt-2 text-xs" style={{ color: '#888' }}>
                  Leave empty to submit feedback without a grade.
                </p>
              </label>
            </div>

            <div className="mt-5" style={{ border: '1.5px solid #000', background: '#f7f7f5', padding: 16 }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="sr-section-label">Pending line comments</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="line-selector"
                    className="inline-flex items-center gap-2"
                    style={{ border: '1.5px solid #000', background: '#fff', padding: '4px 10px', fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700 }}
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
                      style={{ width: 56, border: '1.5px solid #ccc', background: '#f7f7f5', padding: '2px 6px', fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, outline: 'none' }}
                    />
                  </label>

                  <button
                    type="button"
                    disabled={!selectedFileId}
                    onClick={handleOpenSelectorComment}
                    className="sr-btn-primary"
                    style={{ fontSize: 11, padding: '6px 14px' }}
                  >
                    + Add line comment
                  </button>
                </div>
              </div>

              {pendingComments.length === 0 ? (
                <p className="mt-3 text-sm" style={{ color: '#888' }}>
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
                        className={'flex items-start justify-between gap-3 transition-all duration-200 ' + (removing ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100')}
                        style={{ border: '1.5px solid #000', background: '#fff', padding: '8px 12px' }}
                      >
                        <div>
                          <p className="sr-section-label">
                            {filePath} · Line {comment.line_number}
                          </p>
                          <p className="mt-1 text-sm">{comment.content}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePendingComment(comment.key)}
                          className="sr-btn-ghost"
                          style={{ fontSize: 11, padding: '2px 8px', borderColor: '#cc0000', color: '#cc0000' }}
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
                className="sr-btn-primary"
              >
                {saving ? 'Saving review...' : 'Save Review'}
              </button>
              <p className="text-xs" style={{ color: '#888' }}>
                Saving will replace your previous review entirely.
              </p>
            </div>
          </section>

          <section className="sr-card mt-5 p-5 sr-animate" style={{ animationDelay: '180ms' }}>
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 900 }}>Other Reviews</h3>

            {otherReviews.length === 0 ? (
              <p className="mt-3 text-sm" style={{ color: '#888' }}>
                No reviews from other professors yet.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {otherReviews.map((review) => {
                  const isExpanded = expandedOtherIds.has(review.id);

                  return (
                    <article
                      key={review.id}
                      style={{ border: '1.5px solid #000', background: '#f7f7f5', padding: 16 }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="sr-mono text-sm font-bold">
                          {review.professor_name}
                        </p>
                        <span className="sr-tag sr-tag-blue">
                          Grade: {review.grade == null ? '—' : review.grade}/20
                        </span>
                      </div>

                      <p className="mt-2 text-sm">
                        {review.general_comment || 'No general comment.'}
                      </p>

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => toggleOtherReview(review.id)}
                          className="sr-btn-ghost"
                          style={{ fontSize: 11 }}
                        >
                          {isExpanded
                            ? `Hide line comments (${review.comments.length})`
                            : `Show line comments (${review.comments.length})`}
                        </button>

                        {isExpanded ? (
                          <div className="mt-2 space-y-2">
                            {review.comments.length === 0 ? (
                              <p className="text-xs" style={{ color: '#888' }}>No line comments.</p>
                            ) : (
                              review.comments.map((comment) => (
                                <div
                                  key={comment.id}
                                  style={{ border: '1.5px solid #000', background: '#fff', padding: '8px 12px' }}
                                >
                                  <p className="sr-section-label">
                                    {fileIdToPath.get(comment.file) ?? `File #${comment.file}`} · Line {comment.line_number}
                                  </p>
                                  <p className="mt-1 text-sm">{comment.content}</p>
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
          <div className="pointer-events-none fixed right-4 top-20 z-50 animate-[fadeUp_0.2s_ease]">
            <div
              style={{
                border: `1.5px solid ${toast.type === 'success' ? '#1a7a3c' : '#cc0000'}`,
                borderTop: `4px solid ${toast.type === 'success' ? '#1a7a3c' : '#cc0000'}`,
                background: toast.type === 'success' ? '#f2fdf6' : '#fff8f8',
                color: toast.type === 'success' ? '#1a7a3c' : '#cc0000',
                padding: '10px 18px',
                fontFamily: "'Space Mono', monospace",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                boxShadow: '4px 4px 0 #000',
              }}
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
