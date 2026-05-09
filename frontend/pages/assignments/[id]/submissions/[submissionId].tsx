import {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
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
import type {
  AssignmentSubmission,
  AssignmentSubmissionFile,
  ReviewCreatePayload,
  SubmissionReview,
} from '@/services/assignments/assignments.types';
import { Link } from 'lucide-react';

const MonacoEditor = dynamic<EditorProps>(
  () => import('@monaco-editor/react').then((module) => module.default),
  { ssr: false }
);

const COMMENT_BUTTON_SIZE_PX = 28;

type ViewState = 'idle' | 'loading' | 'ready' | 'error';
type TreeDirNode = { kind: 'dir'; name: string; fullPath: string; children: TreeNode[] };
type TreeFileNode = { kind: 'file'; name: string; fullPath: string; file: AssignmentSubmissionFile };
type TreeNode = TreeDirNode | TreeFileNode;
type BuilderDirNode = { kind: 'dir'; name: string; fullPath: string; children: Map<string, BuilderNode> };
type BuilderFileNode = TreeFileNode;
type BuilderNode = BuilderDirNode | BuilderFileNode;
type DraftLineComment = { key: string; file_id: number; line_number: number; content: string };
type InlineCommentDraft = { lineNumber: number; fileId: number; content: string; top: number };
type ToastState = { type: 'success' | 'error'; message: string } | null;

const PAGE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --ink:          #000000;
    --paper:        #ffffff;
    --navy:         #051650;
    --rule:         1.5px solid #000;
    --surface:      #f7f7f5;
    --surface-2:    #f0efec;
    --border-soft:  #e0e0e0;
    --text-sub:     #444444;
    --text-muted:   #666666;
    --red:          #cc0000;
    --green:        #1a7a3c;
    --orange:       #b85c00;
    --blue:         #1a4fa8;
    --font-display: 'Playfair Display', Georgia, serif;
    --font-mono:    'Space Mono', monospace;
    --font-body:    'DM Sans', sans-serif;
  }

  .ap-page {
    min-height: 100vh;
    background: var(--paper);
    font-family: var(--font-body);
    color: var(--ink);
    position: relative;
  }
  .ap-page::before {
    content: '';
    position: fixed;
    top: 0; right: 0;
    width: 280px;
    height: 100vh;
    background: var(--navy);
    clip-path: polygon(80px 0, 100% 0, 100% 100%, 0 100%);
    z-index: 0;
    pointer-events: none;
  }

  .ap-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 40px 28px 80px;
    position: relative;
    z-index: 1;
  }

  .ap-breadcrumb {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 36px;
    font-family: var(--font-mono); font-size: 10px;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted);
  }
  .ap-breadcrumb-link {
    color: var(--navy); font-weight: 700; text-decoration: none;
    border-bottom: 1.5px solid var(--navy); padding-bottom: 1px;
    transition: opacity 0.15s;
  }
  .ap-breadcrumb-link:hover { opacity: 0.65; }
  .ap-breadcrumb-sep { color: #aaa; }

  .ap-page-header {
    display: flex; flex-wrap: wrap;
    align-items: flex-end; justify-content: space-between;
    gap: 16px; padding-bottom: 28px;
    border-bottom: var(--rule); margin-bottom: 28px;
  }
  .ap-page-title {
    font-family: var(--font-display); font-size: 36px;
    font-weight: 900; color: var(--ink);
    margin: 0 0 6px; line-height: 1.05; letter-spacing: -0.02em;
  }
  .ap-page-title span { color: var(--navy); }
  .ap-page-subtitle {
    font-family: var(--font-mono); font-size: 9.5px;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--text-muted); font-weight: 700; margin: 0;
  }

  .ap-card {
    background: var(--surface);
    border: var(--rule);
    padding: 20px;
    margin-bottom: 24px;
  }

  .ap-layout-grid {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 24px;
    margin-bottom: 24px;
  }

  .ap-file-tree {
    background: var(--surface);
    border: var(--rule);
    height: fit-content;
    max-height: 70vh;
    overflow-y: auto;
  }
  .ap-file-tree-header {
    padding: 14px;
    border-bottom: var(--rule);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
  }
  .ap-file-tree-item {
    padding: 8px 12px;
    font-size: 13px;
    cursor: pointer;
    border-left: 3px solid transparent;
  }
  .ap-file-tree-item.selected {
    background: var(--surface-2);
    border-left-color: var(--navy);
    font-weight: 700;
  }

  .ap-editor {
    background: #1e1e1e;
    border: var(--rule);
    height: 70vh;
    position: relative;
  }

  .ap-review-section {
    background: var(--surface);
    border: var(--rule);
    padding: 20px;
  }

  .ap-input, .ap-textarea {
    width: 100%;
    padding: 10px 14px;
    background: var(--paper);
    border: var(--rule);
    font-family: var(--font-body);
    font-size: 13px;
    outline: none;
  }
  .ap-input:focus, .ap-textarea:focus {
    box-shadow: 3px 3px 0 var(--navy);
    border-color: var(--navy);
  }

  .btn-primary {
    padding: 11px 24px;
    background: var(--navy); color: var(--paper);
    border: 1.5px solid var(--navy);
    font-family: var(--font-mono); font-size: 11px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    cursor: pointer;
  }
  .btn-primary:hover { background: var(--ink); transform: translate(-2px, -2px); box-shadow: 4px 4px 0 var(--navy); }
  .btn-outline {
    padding: 11px 20px;
    background: transparent;
    border: var(--rule);
    font-family: var(--font-mono); font-size: 11px; font-weight: 700;
    cursor: pointer;
  }

  .loading-spinner {
    display: inline-block;
    width: 24px; height: 24px;
    border: 2px solid var(--border-soft);
    border-top-color: var(--navy);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 960px) {
    .ap-layout-grid { grid-template-columns: 1fr; }
    .ap-page::before { display: none; }
  }
`;

const normalizePath = (path: string): string => path.replace(/\\/g, '/').replace(/^\/+/, '') || path;
const getDisplayPath = (file: AssignmentSubmissionFile): string => normalizePath(file.file_path) || file.file_name;
const formatSubmittedAt = (value: string): string => new Date(value).toLocaleString();
const formatFileSize = (value: number): string => {
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};
const languageFromFilename = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const map: Record<string, string> = {
    py: 'python', js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
    c: 'c', cpp: 'cpp', java: 'java', json: 'json', md: 'markdown', html: 'html', css: 'css',
  };
  return map[ext] || 'plaintext';
};

const buildFileTree = (files: AssignmentSubmissionFile[]): TreeNode[] => {
  const root: BuilderDirNode = { kind: 'dir', name: '', fullPath: '', children: new Map() };
  for (const file of files) {
    const parts = getDisplayPath(file).split('/').filter(Boolean);
    let cursor = root;
    let parentPath = '';
    parts.forEach((part, idx) => {
      const isLast = idx === parts.length - 1;
      const nodePath = parentPath ? `${parentPath}/${part}` : part;
      if (isLast) {
        cursor.children.set(`file:${nodePath}`, { kind: 'file', name: part, fullPath: nodePath, file });
      } else {
        const dirKey = `dir:${nodePath}`;
        if (!cursor.children.has(dirKey)) {
          cursor.children.set(dirKey, { kind: 'dir', name: part, fullPath: nodePath, children: new Map() });
        }
        cursor = cursor.children.get(dirKey) as BuilderDirNode;
        parentPath = nodePath;
      }
    });
  }
  const toArray = (node: BuilderDirNode): TreeNode[] => {
    const children = Array.from(node.children.values());
    const dirs = children.filter((c): c is BuilderDirNode => c.kind === 'dir').map(d => ({ ...d, children: toArray(d) }));
    const files = children.filter((c): c is BuilderFileNode => c.kind === 'file');
    return [...dirs, ...files];
  };
  return toArray(root);
};

const flattenFiles = (nodes: TreeNode[]): TreeFileNode[] => {
  const out: TreeFileNode[] = [];
  const visit = (items: TreeNode[]) => items.forEach(item => item.kind === 'file' ? out.push(item) : visit(item.children));
  visit(nodes);
  return out;
};

const splitReviews = (reviews: SubmissionReview[], firstName: string, lastName: string) => {
  const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
  const myReview = reviews.find(r => r.professor_name.trim().toLowerCase() === fullName) ?? null;
  return { myReview, otherReviews: myReview ? reviews.filter(r => r.id !== myReview.id) : reviews };
};

function LoadingShell() {
  return (
    <div className="ap-page">
      <Header activePage="Assignments" />
      <div className="ap-container">
        <div className="ap-card" style={{ textAlign: 'center', padding: '60px' }}>
          <div className="loading-spinner" />
          <p style={{ marginTop: '16px' }}>Loading submission review...</p>
        </div>
      </div>
    </div>
  );
}

const FileTree = memo(function FileTree({
  nodes, selectedFileId, onSelectFile,
}: {
  nodes: TreeNode[];
  selectedFileId: number | null;
  onSelectFile: (file: AssignmentSubmissionFile) => void;
}) {
  const render = (items: TreeNode[], depth = 0) => items.map(node => {
    if (node.kind === 'dir') {
      return (
        <div key={node.fullPath}>
          <div style={{ paddingLeft: 8 + depth * 14, padding: '6px 0', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            📁 {node.name}
          </div>
          <div>{render(node.children, depth + 1)}</div>
        </div>
      );
    }
    const isSelected = node.file.id === selectedFileId;
    return (
      <button
        key={node.file.id}
        onClick={() => onSelectFile(node.file)}
        className={`ap-file-tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 14, width: '100%', textAlign: 'left' }}
      >
        📄 {node.name}
      </button>
    );
  });
  return <div>{render(nodes)}</div>;
});

export default function AssignmentSubmissionReviewPage() {
  return (
    <ProtectedRoute allowedRole="professor">
      <AssignmentSubmissionReviewPageContent />
    </ProtectedRoute>
  );
}

function AssignmentSubmissionReviewPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "ap-review-styles";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id;
      tag.textContent = PAGE_CSS;
      document.head.appendChild(tag);
    }
  }, []);

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
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [hoverButtonTop, setHoverButtonTop] = useState(0);
  const [inlineComment, setInlineComment] = useState<InlineCommentDraft | null>(null);
  const [expandedOtherIds, setExpandedOtherIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<ToastState>(null);

  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const editorDisposablesRef = useRef<IDisposable[]>([]);
  const decorationIdsRef = useRef<string[]>([]);
  const fileCacheRef = useRef<Map<number, string>>(new Map());

  const assignmentId = useMemo(() => {
    const raw = router.query.id;
    const parsed = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [router.query.id]);
  const submissionId = useMemo(() => {
    const raw = router.query.submissionId;
    const parsed = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [router.query.submissionId]);

  const visibleFiles = useMemo(() => {
    const files = submission?.files ?? [];
    const q = fileSearch.trim().toLowerCase();
    if (!q) return files;
    return files.filter(f => getDisplayPath(f).toLowerCase().includes(q));
  }, [fileSearch, submission?.files]);
  const fileTree = useMemo(() => buildFileTree(visibleFiles), [visibleFiles]);
  const flatVisibleFiles = useMemo(() => flattenFiles(fileTree), [fileTree]);
  const commentLinesForSelectedFile = useMemo(() => {
    if (!selectedFileId) return [];
    return [...new Set(pendingComments.filter(c => c.file_id === selectedFileId).map(c => c.line_number))].sort();
  }, [pendingComments, selectedFileId]);

  const refreshLineDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const decorations = commentLinesForSelectedFile.map(line => ({
      range: new monaco.Range(line, 1, line, 1),
      options: { isWholeLine: true, className: 'assignment-review-line-highlight', linesDecorationsClassName: 'assignment-review-line-gutter' },
    }));
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, decorations);
  }, [commentLinesForSelectedFile]);

  useEffect(() => { refreshLineDecorations(); }, [refreshLineDecorations]);

  const openFile = useCallback(async (file: AssignmentSubmissionFile) => {
    if (!assignmentId || !submissionId) return;
    const displayPath = getDisplayPath(file);
    const cacheHit = fileCacheRef.current.get(file.id);
    setSelectedFileId(file.id);
    setSelectedFilePath(displayPath);
    setEditorLanguage(languageFromFilename(displayPath));
    setFileError(null);
    if (cacheHit) {
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
  }, [assignmentId, submissionId]);

  const handleEditorMount: EditorProps['onMount'] = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editorDisposablesRef.current.forEach(d => d.dispose());
    editorDisposablesRef.current = [];
    const onMouseMove = editor.onMouseMove(e => {
      const line = e.target.position?.lineNumber;
      if (line && selectedFileId) {
        setHoveredLine(line);
        const top = Math.max(4, editor.getTopForLineNumber(line) - editor.getScrollTop() + 8);
        setHoverButtonTop(top);
      }
    });
    const onMouseLeave = editor.onMouseLeave(() => setHoveredLine(null));
    const onMouseDown = editor.onMouseDown(e => {
      const line = e.target.position?.lineNumber;
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS && line && selectedFileId) {
        setInlineComment({ lineNumber: line, fileId: selectedFileId, content: '', top: 0 });
      }
    });
    editorDisposablesRef.current.push(onMouseMove, onMouseLeave, onMouseDown);
    refreshLineDecorations();
  }, [refreshLineDecorations, selectedFileId]);

  const handleSaveReview = useCallback(async () => {
    if (!assignmentId || !submissionId) return;
    let grade: number | null = null;
    if (gradeInput.trim()) {
      const num = Number(gradeInput);
      if (num < 0 || num > 20) {
        setToast({ type: 'error', message: 'Grade must be 0–20.' });
        return;
      }
      grade = num;
    }
    setSaving(true);
    try {
      await createOrReplaceReview(assignmentId, submissionId, {
        general_comment: generalComment.trim(),
        grade,
        comments: pendingComments.map(c => ({ file_id: c.file_id, line_number: c.line_number, content: c.content })),
      });
      const reviews = await getReviews(assignmentId, submissionId);
      const split = splitReviews(reviews, user!.first_name, user!.last_name);
      setMyReview(split.myReview);
      setOtherReviews(split.otherReviews);
      setToast({ type: 'success', message: 'Review saved.' });
    } catch {
      setToast({ type: 'error', message: 'Failed to save review.' });
    } finally {
      setSaving(false);
    }
  }, [assignmentId, submissionId, gradeInput, generalComment, pendingComments, user]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!assignmentId || !submissionId || !user) {
      setViewState('error');
      setPageError('Invalid assignment or submission id.');
      return;
    }
    let cancelled = false;
    const load = async () => {
      setViewState('loading');
      try {
        const [submissionData, reviews] = await Promise.all([
          getSubmission(assignmentId, submissionId),
          getReviews(assignmentId, submissionId),
        ]);
        if (cancelled) return;
        setSubmission(submissionData);
        const split = splitReviews(reviews, user.first_name, user.last_name);
        setMyReview(split.myReview);
        setOtherReviews(split.otherReviews);
        if (split.myReview) {
          setGeneralComment(split.myReview.general_comment ?? '');
          setGradeInput(split.myReview.grade?.toString() ?? '');
          setPendingComments(split.myReview.comments.map(c => ({ key: `saved-${c.id}`, file_id: c.file, line_number: c.line_number, content: c.content })));
        }
        if (submissionData.files?.length) await openFile(submissionData.files[0]);
        setViewState('ready');
      } catch {
        if (!cancelled) { setViewState('error'); setPageError('Failed to load submission.'); }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [assignmentId, submissionId, user, openFile, router.isReady]);

  if (viewState !== 'ready') return <LoadingShell />;

  return (
    <>
      <Head><title>Review Submission – ESICodeHub</title></Head>
      <style jsx global>{`
        .assignment-review-line-highlight { background: rgba(250,204,21,0.2); border-left: 2px solid #eab308; }
        .assignment-review-line-gutter { border-left: 2px solid #f59e0b; }
      `}</style>
      <div className="ap-page">
        <Header activePage="Assignments" />
        <div className="ap-container">
          <nav className="ap-breadcrumb">
            <Link href="/" className="ap-breadcrumb-link">~/home</Link><span className="ap-breadcrumb-sep">/</span>
            <Link href="/assignments" className="ap-breadcrumb-link">assignments</Link><span className="ap-breadcrumb-sep">/</span>
            <span>submission review</span>
          </nav>

          <div className="ap-page-header">
            <div>
              <h1 className="ap-page-title">Review <span>Submission</span></h1>
              <p className="ap-page-subtitle">{submission?.student_name} • {submission?.submitted_at && formatSubmittedAt(submission.submitted_at)}</p>
            </div>
            <button className="btn-outline" onClick={() => router.back()}>← Back</button>
          </div>

          <div className="ap-layout-grid">
            <aside className="ap-file-tree">
              <div className="ap-file-tree-header">FILES</div>
              <div style={{ padding: '8px' }}>
                <input
                  type="text"
                  placeholder="Search files..."
                  value={fileSearch}
                  onChange={e => setFileSearch(e.target.value)}
                  className="ap-input"
                  style={{ marginBottom: '12px' }}
                />
                {flatVisibleFiles.length === 0 ? (
                  <p style={{ padding: '12px', color: 'var(--text-muted)' }}>No files</p>
                ) : (
                  <FileTree nodes={fileTree} selectedFileId={selectedFileId} onSelectFile={openFile} />
                )}
              </div>
            </aside>

            <div className="ap-editor">
              <div style={{ background: '#2d2d2d', padding: '8px 12px', borderBottom: '1px solid #444', fontFamily: 'monospace', fontSize: '12px', color: '#ccc' }}>
                {selectedFilePath || 'Select a file'} {selectedFileId && `(${commentLinesForSelectedFile.length} comment(s))`}
              </div>
              {fileLoading && <div className="loading-spinner" style={{ position: 'absolute', top: '50%', left: '50%' }} />}
              {selectedFileId ? (
                <div style={{ height: 'calc(100% - 36px)', position: 'relative' }}>
                  {hoveredLine && !inlineComment && (
                    <button
                      style={{ position: 'absolute', right: 8, top: hoverButtonTop, zIndex: 10, background: '#facc15', border: 'none', borderRadius: '50%', width: 28, height: 28, fontSize: 18, cursor: 'pointer' }}
                      onClick={() => setInlineComment({ lineNumber: hoveredLine, fileId: selectedFileId, content: '', top: hoverButtonTop })}
                    >+</button>
                  )}
                  {inlineComment && (
                    <div style={{ position: 'absolute', right: 16, top: inlineComment.top, background: 'white', border: 'var(--rule)', padding: '12px', width: 260, zIndex: 20 }}>
                      <textarea
                        rows={3}
                        value={inlineComment.content}
                        onChange={e => setInlineComment({ ...inlineComment, content: e.target.value })}
                        className="ap-input"
                        placeholder="Line comment..."
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="btn-outline" onClick={() => setInlineComment(null)}>Cancel</button>
                        <button className="btn-primary" onClick={() => {
                          if (inlineComment.content.trim()) {
                            setPendingComments(prev => [...prev, { key: Date.now().toString(), file_id: inlineComment.fileId, line_number: inlineComment.lineNumber, content: inlineComment.content }]);
                            setInlineComment(null);
                          }
                        }}>Add</button>
                      </div>
                    </div>
                  )}
                  <MonacoEditor
                    height="100%"
                    theme="vs-dark"
                    language={editorLanguage}
                    value={editorValue}
                    onMount={handleEditorMount}
                    options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on', fontSize: 13, glyphMargin: true }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  Select a file from the tree
                </div>
              )}
              {fileError && <div style={{ padding: '8px', background: '#ffeeee', borderTop: '1px solid var(--red)', color: 'var(--red)' }}>{fileError}</div>}
            </div>
          </div>

          <div className="ap-review-section">
            <h2 className="ap-page-title" style={{ fontSize: '1.4rem', marginBottom: '12px' }}>My Review</h2>
            <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
              <textarea
                value={generalComment}
                onChange={e => setGeneralComment(e.target.value)}
                placeholder="General feedback for the student..."
                rows={4}
                className="ap-textarea"
              />
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Grade (0–20) – leave empty to skip</label>
                <input type="number" min={0} max={20} step={0.25} value={gradeInput} onChange={e => setGradeInput(e.target.value)} className="ap-input" style={{ width: '120px', marginTop: '6px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 className="ap-page-subtitle">Line comments</h3>
              {pendingComments.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No line comments yet. Click + in the editor to add one.</p>
              ) : (
                pendingComments.map(c => (
                  <div key={c.key} style={{ background: 'var(--paper)', border: 'var(--rule)', padding: '10px', marginTop: '8px' }}>
                    <p><strong>File:</strong> {getDisplayPath(submission?.files?.find(f => f.id === c.file_id) || { file_name: '?' } as any)} • Line {c.line_number}</p>
                    <p>{c.content}</p>
                    <button className="btn-outline" style={{ fontSize: '10px', padding: '4px 12px' }} onClick={() => setPendingComments(prev => prev.filter(p => p.key !== c.key))}>Remove</button>
                  </div>
                ))
              )}
            </div>

            <button className="btn-primary" onClick={handleSaveReview} disabled={saving}>
              {saving ? 'Saving...' : 'Save Review'}
            </button>
          </div>

          {otherReviews.length > 0 && (
            <div className="ap-review-section" style={{ marginTop: '24px' }}>
              <h2 className="ap-page-title" style={{ fontSize: '1.4rem', marginBottom: '12px' }}>Other Reviews</h2>
              {otherReviews.map(r => (
                <div key={r.id} style={{ borderTop: 'var(--rule)', paddingTop: '16px', marginTop: '16px' }}>
                  <p><strong>{r.professor_name}</strong> • Grade: {r.grade ?? '—'}/20</p>
                  <p>{r.general_comment || 'No general comment.'}</p>
                  <button className="btn-outline" style={{ fontSize: '10px' }} onClick={() => setExpandedOtherIds(prev => { const s = new Set(prev); s.has(r.id) ? s.delete(r.id) : s.add(r.id); return s; })}>
                    {expandedOtherIds.has(r.id) ? 'Hide' : 'Show'} line comments ({r.comments.length})
                  </button>
                  {expandedOtherIds.has(r.id) && r.comments.map(c => (
                    <div key={c.id} style={{ background: 'var(--paper)', border: 'var(--rule)', padding: '8px', marginTop: '8px' }}>
                      <p><strong>File:</strong> {getDisplayPath(submission?.files?.find(f => f.id === c.file) || { file_name: '?' } as any)} • Line {c.line_number}</p>
                      <p>{c.content}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--navy)', color: 'white', padding: '12px 24px', zIndex: 100 }}>{toast.message}</div>}
      </div>
    </>
  );
}